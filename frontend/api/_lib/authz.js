// Returns "admin" | "owner" | "member" | null (no access).
export async function getGroupRole(db, groupId, session) {
  if (!session) return null;

  const { rows } = await db.query("SELECT owner_id FROM groups WHERE id = $1", [groupId]);
  if (!rows[0]) return null;

  // Ownership is checked first so an admin who also owns this particular
  // group gets the more specific "owner" role (needed since some actions,
  // like inviting members, are owner-only even for admins).
  if (rows[0].owner_id === session.sub) return "owner";
  if (session.isAdmin) return "admin";

  const { rows: memberRows } = await db.query(
    "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
    [groupId, session.sub]
  );
  return memberRows[0] ? "member" : null;
}

export const canManageMembers = (role) => role === "owner" || role === "admin";
export const canInvite = (role) => role === "owner";
export const canLogGames = (role) => role === "owner" || role === "member" || role === "admin";
