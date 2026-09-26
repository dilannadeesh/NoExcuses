export function rankingValue(entry, rankingMethod) {
  if (rankingMethod === "elo") return entry.eloRating;
  if (rankingMethod === "points") return entry.points;
  return `${entry.winPercentage}%`;
}

export function rankingLabel(rankingMethod) {
  if (rankingMethod === "elo") return "Rating";
  if (rankingMethod === "points") return "Points";
  return "Win %";
}
