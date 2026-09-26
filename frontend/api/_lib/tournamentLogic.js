import crypto from "node:crypto";

// Standard "circle method" round-robin scheduler. Given N entries, produces
// N-1 rounds (or N if N is odd, since a bye takes up a round-slot) where
// every entry plays every other entry exactly once. One entry is held
// fixed and the rest rotate around it each round.
//
// entryIds: array of tournament_entries.id (NOT user ids)
// Returns: array of rounds, each an array of [entryIdA, entryIdB] pairs.
// A bye (odd entry count) simply produces no fixture for that entry that
// round -- it isn't represented in the output at all.
export function generateRoundRobinRounds(entryIds) {
  const ids = [...entryIds];
  if (ids.length < 2) return [];
  if (ids.length % 2 !== 0) ids.push(null); // null = bye slot

  const n = ids.length;
  const fixed = ids[0];
  let rotating = ids.slice(1);
  const rounds = [];

  for (let round = 0; round < n - 1; round++) {
    const current = [fixed, ...rotating];
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = current[i];
      const b = current[n - 1 - i];
      if (a !== null && b !== null) pairs.push([a, b]);
    }
    rounds.push(pairs);
    rotating.unshift(rotating.pop());
  }

  return rounds;
}

export function generatePublicSlug() {
  return crypto.randomBytes(8).toString("hex");
}
