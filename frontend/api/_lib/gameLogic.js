// Shared by game creation and game editing so the two can't drift apart.

export function validateGameShape(match_type, side1, side2, sets) {
  if (!["singles", "doubles"].includes(match_type)) {
    return "match_type must be 'singles' or 'doubles'";
  }
  const expectedCount = match_type === "singles" ? 1 : 2;
  if (
    !Array.isArray(side1) ||
    !Array.isArray(side2) ||
    side1.length !== expectedCount ||
    side2.length !== expectedCount
  ) {
    return `Each side needs exactly ${expectedCount} player(s)`;
  }
  if (!Array.isArray(sets) || sets.length === 0) {
    return "At least one set is required";
  }
  return null;
}

export async function allPlayersAreMembers(db, groupId, side1, side2) {
  const allPlayerIds = [...side1, ...side2];
  const { rows } = await db.query(
    "SELECT user_id FROM group_members WHERE group_id = $1 AND user_id = ANY($2::int[])",
    [groupId, allPlayerIds]
  );
  return rows.length === new Set(allPlayerIds).size;
}

export function computeWinnerSide(sets) {
  let side1Sets = 0;
  let side2Sets = 0;
  for (const s of sets) {
    if (s.side1_score > s.side2_score) side1Sets++;
    else if (s.side2_score > s.side1_score) side2Sets++;
  }
  return side1Sets > side2Sets ? 1 : 2;
}
