import { getPool, ensureSchema, sendJson, readJsonBody } from "../../../_lib/db.js";
import { requireAuth } from "../../../_lib/auth.js";
import { getGroupRole, isOwner } from "../../../_lib/authz.js";
import { generatePublicSlug } from "../../../_lib/tournamentLogic.js";

export default async function handler(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  await ensureSchema();
  const db = getPool();
  const { id: groupId } = req.query;
  const role = await getGroupRole(db, groupId, session);
  if (!role) return sendJson(res, 404, { error: "Group not found" });

  if (req.method === "GET") {
    const { rows } = await db.query(
      `SELECT t.*,
        (SELECT COUNT(*)::int FROM tournament_entries te WHERE te.tournament_id = t.id) AS entry_count
       FROM tournaments t WHERE t.group_id = $1 ORDER BY t.created_at DESC`,
      [groupId]
    );
    return sendJson(res, 200, rows);
  }

  if (req.method === "POST") {
    // Organizing a tournament is an owner action, same tier as managing membership.
    if (!isOwner(role)) return sendJson(res, 403, { error: "Only the group owner can create a tournament" });

    const { name, match_type, entries } = await readJsonBody(req);
    if (!name || !name.trim()) return sendJson(res, 400, { error: "Name is required" });
    if (!["singles", "doubles"].includes(match_type)) {
      return sendJson(res, 400, { error: "match_type must be 'singles' or 'doubles'" });
    }
    const expectedSize = match_type === "singles" ? 1 : 2;
    if (!Array.isArray(entries) || entries.length < 2) {
      return sendJson(res, 400, { error: "At least 2 entries are required" });
    }
    if (!entries.every((e) => Array.isArray(e) && e.length === expectedSize)) {
      return sendJson(res, 400, { error: `Each entry needs exactly ${expectedSize} player(s)` });
    }

    const allPlayerIds = entries.flat();
    if (new Set(allPlayerIds).size !== allPlayerIds.length) {
      return sendJson(res, 400, { error: "A player can't appear in more than one entry" });
    }
    const { rows: memberRows } = await db.query(
      "SELECT user_id FROM group_members WHERE group_id = $1 AND user_id = ANY($2::int[])",
      [groupId, allPlayerIds]
    );
    if (memberRows.length !== new Set(allPlayerIds).size) {
      return sendJson(res, 400, { error: "All players must be members of this group" });
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const { rows: tRows } = await client.query(
        `INSERT INTO tournaments (group_id, name, match_type, public_slug, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [groupId, name.trim(), match_type, generatePublicSlug(), session.sub]
      );
      const tournament = tRows[0];

      for (const entry of entries) {
        await client.query(
          "INSERT INTO tournament_entries (tournament_id, player1_id, player2_id) VALUES ($1, $2, $3)",
          [tournament.id, entry[0], entry[1] || null]
        );
      }
      await client.query("COMMIT");
      return sendJson(res, 201, tournament);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  res.setHeader("Allow", "GET, POST");
  return sendJson(res, 405, { error: "Method not allowed" });
}
