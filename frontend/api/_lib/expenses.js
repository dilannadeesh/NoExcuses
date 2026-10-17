import { getPool, sendJson, readJsonBody } from "./db.js";
import { canLogGames, canManageMembers } from "./authz.js";
import { validateExpense, netBalancesFor } from "./expenseLogic.js";
import { sendPush } from "./push.js";

// Group expenses live behind the group endpoint (Vercel's function limit means
// no new files under /api):
//   GET    /api/groups/:id?expenses=balances   who I owe / who owes me
//   GET    /api/groups/:id?expenses=list       every expense, newest first
//   POST   /api/groups/:id?expenses=1          add an expense
//   POST   /api/groups/:id?settle=:userId      pay back everything I owe that person
//   DELETE /api/groups/:id?expense=:expenseId  remove one
export function isExpenseRequest(query) {
  return query.expenses !== undefined || query.expense !== undefined || query.settle !== undefined;
}

async function loadDebts(db, groupId) {
  const { rows } = await db.query(
    `SELECT s.user_id AS debtor, e.paid_by AS creditor, SUM(s.share_cents)::int AS cents
       FROM expense_splits s JOIN expenses e ON e.id = s.expense_id
      WHERE e.group_id = $1 AND s.user_id <> e.paid_by
      GROUP BY s.user_id, e.paid_by`,
    [groupId]
  );
  return rows;
}

async function getBalances(db, groupId, session, res) {
  const result = netBalancesFor(session.sub, await loadDebts(db, groupId));
  const ids = result.people.map((p) => p.id);
  const names = new Map();
  if (ids.length) {
    const { rows: users } = await db.query("SELECT id, name FROM users WHERE id = ANY($1::int[])", [ids]);
    for (const u of users) names.set(u.id, u.name);
  }
  return sendJson(res, 200, {
    ...result,
    people: result.people.map((p) => ({ ...p, name: names.get(p.id) || "Unknown" })),
  });
}

async function listExpenses(db, groupId, session, role, res) {
  const { rows } = await db.query(
    `SELECT e.id, e.description, e.amount_cents, e.paid_by, e.created_by, e.created_at,
            pu.name AS paid_by_name, cu.name AS created_by_name,
            e.kind,
            (SELECT u2.name FROM expense_splits ss JOIN users u2 ON u2.id = ss.user_id
              WHERE ss.expense_id = e.id AND e.kind = 'settlement' LIMIT 1) AS settled_with_name,
            COALESCE(me.share_cents, 0) AS my_share_cents,
            (me.user_id IS NOT NULL) AS i_am_in,
            (SELECT COUNT(*)::int FROM expense_splits x WHERE x.expense_id = e.id) AS split_count
       FROM expenses e
       JOIN users pu ON pu.id = e.paid_by
       LEFT JOIN users cu ON cu.id = e.created_by
       LEFT JOIN expense_splits me ON me.expense_id = e.id AND me.user_id = $2
      WHERE e.group_id = $1
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT 200`,
    [groupId, session.sub]
  );
  const canDeleteAny = canManageMembers(role);
  return sendJson(
    res,
    200,
    rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      settled_with_name: r.settled_with_name,
      description: r.description,
      amount_cents: r.amount_cents,
      paid_by: r.paid_by,
      paid_by_name: r.paid_by_name,
      added_by_name: r.created_by_name,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
      my_share_cents: r.my_share_cents,
      i_am_in: r.i_am_in,
      split_count: r.split_count,
      can_delete: canDeleteAny || r.created_by === session.sub,
    }))
  );
}

async function addExpense(req, db, groupId, session, role, res) {
  if (!canLogGames(role)) return sendJson(res, 403, { error: "Only group members can add expenses" });
  const body = await readJsonBody(req);
  const { rows: m } = await db.query("SELECT user_id FROM group_members WHERE group_id = $1", [groupId]);
  const result = validateExpense(body, m.map((r) => r.user_id));
  if (!result.ok) return sendJson(res, 400, { error: result.error });
  const { amountCents, description, paidBy, splits } = result.value;

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO expenses (group_id, paid_by, amount_cents, description, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [groupId, paidBy, amountCents, description, session.sub]
    );
    const expenseId = rows[0].id;
    await client.query(
      `INSERT INTO expense_splits (expense_id, user_id, share_cents)
       SELECT $1, u, c FROM unnest($2::int[], $3::int[]) AS t(u, c)`,
      [expenseId, splits.map((s) => s.userId), splits.map((s) => s.shareCents)]
    );
    await client.query("COMMIT");
    return sendJson(res, 201, { id: expenseId });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// "Settle up": the viewer pays back everything they currently owe one person.
// The client sends the amount it showed so a stale screen can't settle a
// different number; the server works out the real amount itself.
async function settleUp(req, db, groupId, session, role, creditorParam, res) {
  if (!canLogGames(role)) return sendJson(res, 403, { error: "Only group members can settle up" });
  const creditorId = Number(creditorParam);
  const body = await readJsonBody(req);
  if (!Number.isInteger(creditorId) || creditorId === session.sub) {
    return sendJson(res, 400, { error: "Choose someone else to settle up with" });
  }
  const mine = netBalancesFor(session.sub, await loadDebts(db, groupId)).people.find((p) => p.id === creditorId);
  const owe = mine && mine.net_cents < 0 ? -mine.net_cents : 0;
  if (owe === 0) return sendJson(res, 409, { error: "You don't owe them anything right now", owe_cents: 0 });
  if (body?.amount_cents !== owe) {
    return sendJson(res, 409, { error: "The amount changed. Check the new amount and try again.", owe_cents: owe });
  }

  const client = await db.connect();
  let expenseId;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO expenses (group_id, paid_by, amount_cents, description, created_by, kind)
       VALUES ($1, $2, $3, 'Settled up', $2, 'settlement') RETURNING id`,
      [groupId, session.sub, owe]
    );
    expenseId = rows[0].id;
    await client.query("INSERT INTO expense_splits (expense_id, user_id, share_cents) VALUES ($1, $2, $3)", [expenseId, creditorId, owe]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  // Tell the person who was paid. A failed push never undoes the settlement.
  const { rows: names } = await db.query(
    `SELECT (SELECT name FROM users WHERE id = $1) AS me, (SELECT name FROM groups WHERE id = $2) AS grp`,
    [session.sub, groupId]
  );
  const dollars = `$${Math.floor(owe / 100).toLocaleString("en-US")}.${String(owe % 100).padStart(2, "0")}`;
  const pushed = await sendPush(db, [creditorId], {
    title: "Settled up",
    body: `${names[0].me} settled ${dollars} with you in ${names[0].grp}`,
    data: { route: `/groups/${groupId}/owe`, groupId: String(groupId) },
  });
  return sendJson(res, 201, { id: expenseId, amount_cents: owe, notified: pushed.sent > 0 });
}

async function deleteExpense(db, groupId, session, role, expenseId, res) {
  const { rows } = await db.query("SELECT created_by FROM expenses WHERE id = $1 AND group_id = $2", [
    Number(expenseId) || 0,
    groupId,
  ]);
  if (!rows[0]) return sendJson(res, 404, { error: "Expense not found" });
  if (!canManageMembers(role) && rows[0].created_by !== session.sub) {
    return sendJson(res, 403, { error: "Only whoever added this expense, or the group owner, can delete it" });
  }
  await db.query("DELETE FROM expenses WHERE id = $1", [Number(expenseId)]);
  return res.status(204).end();
}

export async function handleExpenses(req, res, session, role, groupId) {
  const db = getPool();
  const { expenses, expense } = req.query;

  if (req.method === "GET" && expenses === "balances") return getBalances(db, groupId, session, res);
  if (req.method === "GET" && expenses === "list") return listExpenses(db, groupId, session, role, res);
  if (req.method === "POST" && req.query.settle !== undefined) return settleUp(req, db, groupId, session, role, req.query.settle, res);
  if (req.method === "POST" && expenses !== undefined) return addExpense(req, db, groupId, session, role, res);
  if (req.method === "DELETE" && expense !== undefined) return deleteExpense(db, groupId, session, role, expense, res);

  res.setHeader("Allow", "GET, POST, DELETE");
  return sendJson(res, 405, { error: "Method not allowed" });
}
