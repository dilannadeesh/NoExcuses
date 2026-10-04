import crypto from "node:crypto";
import { getPool, ensureSchema, sendJson, readJsonBody } from "../_lib/db.js";
import { requireAdmin, isValidEmail, hashPassword } from "../_lib/auth.js";
import { getPathSegments } from "../_lib/pathSegments.js";

// --- Users ---

async function listUsers(req, res, db) {
  const { rows } = await db.query(`
    SELECT u.id, u.name, u.email, u.is_admin, u.created_at,
      (u.password_hash IS NOT NULL) AS has_joined,
      (SELECT COUNT(*)::int FROM groups g WHERE g.owner_id = u.id) AS groups_owned,
      (SELECT COUNT(*)::int FROM group_members gm WHERE gm.user_id = u.id) AS groups_member_of,
      (SELECT COUNT(*)::int FROM game_players gp WHERE gp.user_id = u.id) AS games_played
    FROM users u ORDER BY u.created_at DESC
  `);
  return sendJson(res, 200, rows);
}

async function createUser(req, res, db) {
  const { name, email } = await readJsonBody(req);
  if (!name || !name.trim()) return sendJson(res, 400, { error: "Name is required" });
  if (!isValidEmail(email)) return sendJson(res, 400, { error: "A valid email is required" });
  const normalizedEmail = email.trim().toLowerCase();

  // Same upsert-by-email pattern as inviting a group member: link to an
  // existing account (placeholder or real) rather than erroring, since a
  // super admin plausibly wants "make sure this person exists" more often
  // than a hard failure on an existing email.
  const { rows } = await db.query(
    `INSERT INTO users (name, email) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id, name, email, is_admin, created_at, (password_hash IS NOT NULL) AS has_joined`,
    [name.trim(), normalizedEmail]
  );
  return sendJson(res, 201, rows[0]);
}

function generateTempPassword() {
  // 12 random alphanumeric-ish characters, readable enough to relay verbally
  // or by text -- base64url avoids ambiguous-looking punctuation.
  return crypto.randomBytes(9).toString("base64url");
}

async function updateUser(req, res, db, userId, adminSession) {
  const { name, email, is_admin, password, reset_password } = await readJsonBody(req);
  const { rows: existingRows } = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
  if (!existingRows[0]) return sendJson(res, 404, { error: "User not found" });

  if (typeof is_admin === "boolean" && !is_admin && Number(userId) === adminSession.sub) {
    const { rows: adminCount } = await db.query("SELECT COUNT(*)::int AS n FROM users WHERE is_admin = true");
    if (adminCount[0].n <= 1) {
      return sendJson(res, 409, { error: "You're the only admin -- promote someone else before demoting yourself." });
    }
  }

  const updated = {
    name: name !== undefined ? name.trim() : existingRows[0].name,
    email: email !== undefined ? email.trim().toLowerCase() : existingRows[0].email,
    is_admin: typeof is_admin === "boolean" ? is_admin : existingRows[0].is_admin,
  };
  if (!updated.name) return sendJson(res, 400, { error: "Name cannot be empty" });
  if (!isValidEmail(updated.email)) return sendJson(res, 400, { error: "A valid email is required" });

  // Password reset: either the admin supplies an explicit new password, or
  // asks for one to be generated (returned once in the response so it can
  // be relayed to the user -- it's never stored or shown again after this).
  let generatedPassword = null;
  let passwordHash = existingRows[0].password_hash;
  if (password !== undefined) {
    if (password.length < 8) return sendJson(res, 400, { error: "Password must be at least 8 characters" });
    passwordHash = await hashPassword(password);
  } else if (reset_password) {
    generatedPassword = generateTempPassword();
    passwordHash = await hashPassword(generatedPassword);
  }

  const { rows } = await db.query(
    `UPDATE users SET name = $1, email = $2, is_admin = $3, password_hash = $4 WHERE id = $5
     RETURNING id, name, email, is_admin, created_at, (password_hash IS NOT NULL) AS has_joined`,
    [updated.name, updated.email, updated.is_admin, passwordHash, userId]
  );
  return sendJson(res, 200, { ...rows[0], generatedPassword: generatedPassword || undefined });
}

async function deleteUser(req, res, db, userId) {
  const { rows: groupsOwned } = await db.query("SELECT COUNT(*)::int AS n FROM groups WHERE owner_id = $1", [
    userId,
  ]);
  if (groupsOwned[0].n > 0) {
    return sendJson(res, 409, {
      error: `This user owns ${groupsOwned[0].n} group(s). Transfer ownership to someone else first, then delete.`,
    });
  }
  const { rows: gamesPlayed } = await db.query("SELECT COUNT(*)::int AS n FROM game_players WHERE user_id = $1", [
    userId,
  ]);
  if (gamesPlayed[0].n > 0) {
    return sendJson(res, 409, {
      error: `This user has played ${gamesPlayed[0].n} logged game(s). Deleting them would corrupt those games' history for the other players, so this isn't supported for accounts with game history.`,
    });
  }

  await db.query("DELETE FROM users WHERE id = $1", [userId]);
  return res.status(204).end();
}

// --- Groups ---

async function createGroup(req, res, db) {
  const { name, owner_id } = await readJsonBody(req);
  if (!name || !name.trim()) return sendJson(res, 400, { error: "Name is required" });
  const { rows: ownerRows } = await db.query("SELECT id FROM users WHERE id = $1", [owner_id]);
  if (!ownerRows[0]) return sendJson(res, 400, { error: "owner_id must be an existing user" });

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("INSERT INTO groups (name, owner_id) VALUES ($1, $2) RETURNING *", [
      name.trim(),
      owner_id,
    ]);
    await client.query("INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
      rows[0].id,
      owner_id,
    ]);
    await client.query("COMMIT");
    return sendJson(res, 201, rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function updateGroup(req, res, db, groupId) {
  const { name, owner_id } = await readJsonBody(req);
  const { rows: existingRows } = await db.query("SELECT * FROM groups WHERE id = $1", [groupId]);
  if (!existingRows[0]) return sendJson(res, 404, { error: "Group not found" });

  if (owner_id !== undefined) {
    const { rows: ownerRows } = await db.query("SELECT id FROM users WHERE id = $1", [owner_id]);
    if (!ownerRows[0]) return sendJson(res, 400, { error: "owner_id must be an existing user" });
  }
  const updated = {
    name: name !== undefined ? name.trim() : existingRows[0].name,
    owner_id: owner_id !== undefined ? owner_id : existingRows[0].owner_id,
  };
  if (!updated.name) return sendJson(res, 400, { error: "Name cannot be empty" });

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("UPDATE groups SET name = $1, owner_id = $2 WHERE id = $3 RETURNING *", [
      updated.name,
      updated.owner_id,
      groupId,
    ]);
    // A new owner should be able to play in the group they now run.
    await client.query("INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
      groupId,
      updated.owner_id,
    ]);
    await client.query("COMMIT");
    return sendJson(res, 200, rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export default async function handler(req, res) {
  await ensureSchema();
  const db = getPool();
  const session = await requireAdmin(req, res, db);
  if (!session) return;

  const segments = getPathSegments(req, "/api/admin/");
  const [resource, id] = segments;

  if (resource === "users") {
    if (!id && req.method === "GET") return listUsers(req, res, db);
    if (!id && req.method === "POST") return createUser(req, res, db);
    if (id && req.method === "PATCH") return updateUser(req, res, db, id, session);
    if (id && req.method === "DELETE") return deleteUser(req, res, db, id);
    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (resource === "groups") {
    if (!id && req.method === "POST") return createGroup(req, res, db);
    if (id && req.method === "PATCH") return updateGroup(req, res, db, id);
    res.setHeader("Allow", "POST, PATCH");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  // Admin-only (we're behind requireAdmin), so safe to be specific: if routing
  // ever breaks again this says what the server actually received.
  return sendJson(res, 404, {
    error: `Not found (admin route; url=${req.url}, query=${JSON.stringify(req.query)}, parsed=${JSON.stringify(segments)})`,
  });
}
