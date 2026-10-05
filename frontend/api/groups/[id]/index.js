import { getPool, ensureSchema, sendJson, readJsonBody } from "../../_lib/db.js";
import { requireAuth } from "../../_lib/auth.js";
import { getGroupRole, isOwner, canManageSchedule } from "../../_lib/authz.js";
import { validateSchedule } from "../../_lib/scheduleLogic.js";

const VALID_RANKING_METHODS = ["win_percentage", "points", "elo"];

// The group plus its owner's name and the date of its planned session (a tiny
// field every page can use to know whether there is a plan today). The plan
// itself is only sent when asked for: GET /api/groups/:id?include=schedule
async function loadGroup(db, id, role, includeSchedule) {
  const { rows } = await db.query(
    `SELECT g.*, u.name AS owner_name, gs.schedule_date
       FROM groups g
       JOIN users u ON u.id = g.owner_id
       LEFT JOIN group_schedules gs ON gs.group_id = g.id
      WHERE g.id = $1`,
    [id]
  );
  const group = { ...rows[0], role };
  if (includeSchedule) {
    const { rows: s } = await db.query(
      `SELECT gs.*, cu.name AS by_name
         FROM group_schedules gs
         LEFT JOIN users cu ON cu.id = gs.created_by
        WHERE gs.group_id = $1`,
      [id]
    );
    const row = s[0];
    group.schedule = row
      ? {
          date: row.schedule_date,
          startTime: row.start_time,
          mode: row.mode,
          courts: row.courts,
          data: row.payload,
          updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
          byName: row.by_name || null,
        }
      : null;
  }
  return group;
}

async function setSchedule(db, id, role, session, schedule, res) {
  if (schedule === null) {
    await db.query("DELETE FROM group_schedules WHERE group_id = $1", [id]);
    return sendJson(res, 200, await loadGroup(db, id, role, true));
  }

  const { rows: members } = await db.query(
    `SELECT u.id, u.name FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = $1`,
    [id]
  );
  const result = validateSchedule(schedule, members);
  if (!result.ok) return sendJson(res, 400, { error: result.error });
  const v = result.value;

  await db.query(
    `INSERT INTO group_schedules (group_id, schedule_date, start_time, mode, courts, payload, created_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (group_id) DO UPDATE SET
       schedule_date = EXCLUDED.schedule_date, start_time = EXCLUDED.start_time, mode = EXCLUDED.mode,
       courts = EXCLUDED.courts, payload = EXCLUDED.payload, created_by = EXCLUDED.created_by, updated_at = now()`,
    [id, v.date, v.startTime, v.mode, v.courts, JSON.stringify(v.payload), session.sub]
  );
  return sendJson(res, 200, await loadGroup(db, id, role, true));
}

export default async function handler(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  await ensureSchema();
  const db = getPool();
  const { id } = req.query;
  const role = await getGroupRole(db, id, session);
  if (!role) return sendJson(res, 404, { error: "Group not found" });

  if (req.method === "GET") {
    return sendJson(res, 200, await loadGroup(db, id, role, req.query.include === "schedule"));
  }

  if (req.method === "PATCH") {
    const body = await readJsonBody(req);

    // Today's games: set (an object) or clear (null) the group's planned session.
    if (body.schedule !== undefined) {
      if (!canManageSchedule(role)) {
        return sendJson(res, 403, { error: "Only the group admin can plan today's games" });
      }
      return setSchedule(db, id, role, session, body.schedule, res);
    }

    if (!isOwner(role)) return sendJson(res, 403, { error: "Only the group owner can change group settings" });
    const { ranking_method } = body;
    if (!VALID_RANKING_METHODS.includes(ranking_method)) {
      return sendJson(res, 400, { error: `ranking_method must be one of: ${VALID_RANKING_METHODS.join(", ")}` });
    }
    const { rows } = await db.query(
      "UPDATE groups SET ranking_method = $1 WHERE id = $2 RETURNING *",
      [ranking_method, id]
    );
    return sendJson(res, 200, { ...rows[0], role });
  }

  if (req.method === "DELETE") {
    if (role !== "owner" && role !== "admin") return sendJson(res, 403, { error: "Not allowed" });
    await db.query("DELETE FROM groups WHERE id = $1", [id]);
    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, PATCH, DELETE");
  return sendJson(res, 405, { error: "Method not allowed" });
}
