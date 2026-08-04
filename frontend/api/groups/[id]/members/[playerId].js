import { getPool, ensureSchema, sendJson } from "../../../_lib/db.js";

export default async function handler(req, res) {
  await ensureSchema();
  const db = getPool();
  const { id: groupId, playerId } = req.query;

  if (req.method === "DELETE") {
    await db.query("DELETE FROM group_members WHERE group_id = $1 AND player_id = $2", [groupId, playerId]);
    return res.status(204).end();
  }

  res.setHeader("Allow", "DELETE");
  return sendJson(res, 405, { error: "Method not allowed" });
}
