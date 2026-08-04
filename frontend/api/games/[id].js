import { getPool, ensureSchema, sendJson } from "../_lib/db.js";

export default async function handler(req, res) {
  await ensureSchema();
  const db = getPool();
  const { id } = req.query;

  if (req.method === "DELETE") {
    await db.query("DELETE FROM games WHERE id = $1", [id]);
    return res.status(204).end();
  }

  res.setHeader("Allow", "DELETE");
  return sendJson(res, 405, { error: "Method not allowed" });
}
