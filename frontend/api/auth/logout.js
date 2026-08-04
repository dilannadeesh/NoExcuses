import { sendJson } from "../_lib/db.js";
import { clearSessionCookie } from "../_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  clearSessionCookie(res);
  return res.status(204).end();
}
