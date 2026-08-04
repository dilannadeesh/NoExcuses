// Returns "admin" | "owner" | "member" | null (no access).
export async function getGroupRole(db, groupId, session) {
  if (!session) return null;
  if (session.isAdmin) return "admin";

  const { rows } = await db.query("SELECT owner_id FROM groups WHERE id = $1", [groupId]);
  if (!rows[0]) return null;
  if (rows[0].owner_id === session.sub) return "owner";

  const { rows: memberRows } = await db.query(
    "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
    [groupId, session.sub]
  );
  return memberRows[0] ? "member" : null;
}

export const canManageMembers = (role) => role === "owner" || role === "admin";
export const canLogGames = (role) => role === "owner" || role === "member" || role === "admin";
