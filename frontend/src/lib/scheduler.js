// "Today's games": builds a 2-hour session of one-set matches from whoever
// turned up. Pure logic -- no React, no network -- so it can be tested alone.
//
// Each round we decide two things:
//   1. WHO PLAYS. Players with the fewest games go first, then whoever has
//      rested longest. That keeps everyone's game count within 1 of each other
//      and means nobody sits out twice in a row unless the numbers force it.
//   2. WHO PLAYS WHOM. A swap-based local search minimises a cost made of
//      - balance:      how even the two teams are (average rating gap),
//      - competition:  how close in level all four players are (doubles),
//      - variety:      penalties for repeating the same partner / opponent.
//
// Skill is a single number per player (we use the Elo rating the app already
// computes; players with no games yet start at the default).

export const SLOT_MINUTES = 12; // games run 10-12 min; plan for the long end so we never overrun
export const SESSION_MINUTES = 120;
export const ROUNDS = Math.floor(SESSION_MINUTES / SLOT_MINUTES);
export const DEFAULT_RATING = 1000;

const PER_MATCH = { singles: 2, doubles: 4 };

// Cost weights, in rating points.
export const DEFAULT_WEIGHTS = {
  // Competitiveness: how much a wide spread of levels inside one match costs.
  // Balance (an even gap between the two sides) is always weighted 1.
  spread: 1.0,
  // Variety is a guard against silly repetition, not the goal: balance and
  // competitiveness come first. Repeats are squared, so a 3rd repeat costs far
  // more than a 1st. (Tuned by sweep -- see test-scheduler.mjs for the targets.)
  partner: 30,
  opponentDoubles: 12,
  opponentSinglesRepeat: 50,
  // Sitting out two rounds running. Large on purpose: it should only happen
  // when the numbers leave no alternative.
  rest: 400,
};

// Search effort (cheap: a whole session is a few ms of work per attempt).
const ATTEMPTS = 12; // whole-session tries; we keep the best
const RESTARTS = 4; // starting points per round
const ITERATIONS = 250; // swap tries per starting point

export function playersPerMatch(mode) {
  const n = PER_MATCH[mode];
  if (!n) throw new Error(`Unknown mode "${mode}" (use "singles" or "doubles")`);
  return n;
}

// You can't fill more courts than you have players for.
export function maxCourts(playerCount, mode) {
  return Math.floor(playerCount / playersPerMatch(mode));
}

// For the setup screen: roughly how many games each person will get.
export function estimateGames(playerCount, mode, courts) {
  const ppm = playersPerMatch(mode);
  const m = Math.min(Math.max(1, Math.floor(courts) || 1), maxCourts(playerCount, mode));
  if (playerCount === 0 || m === 0) return { min: 0, max: 0, courtsUsed: 0 };
  const perPlayer = (ROUNDS * m * ppm) / playerCount;
  return { min: Math.floor(perPlayer), max: Math.ceil(perPlayer), courtsUsed: m };
}

// Deterministic PRNG so a given seed always yields the same schedule
// (and "Regenerate" is just a new seed).
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sq = (x) => x * x;
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const times = (map, a, b) => map.get(pairKey(a, b)) || 0;

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Average rating difference between the two sides (singles: the plain gap).
function sideGap(slice, mode) {
  if (mode === "singles") return Math.abs(slice[0].rating - slice[1].rating);
  return Math.abs(slice[0].rating + slice[1].rating - (slice[2].rating + slice[3].rating)) / 2;
}

function spreadOf(slice) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of slice) {
    if (p.rating < lo) lo = p.rating;
    if (p.rating > hi) hi = p.rating;
  }
  return hi - lo;
}

function matchCost(slice, mode, hist, W) {
  if (mode === "singles") {
    return sideGap(slice, mode) + W.opponentSinglesRepeat * sq(times(hist.opposed, slice[0].id, slice[1].id));
  }
  const [a1, a2, b1, b2] = slice;
  const repeatPartners = sq(times(hist.partnered, a1.id, a2.id)) + sq(times(hist.partnered, b1.id, b2.id));
  const repeatOpponents =
    sq(times(hist.opposed, a1.id, b1.id)) +
    sq(times(hist.opposed, a1.id, b2.id)) +
    sq(times(hist.opposed, a2.id, b1.id)) +
    sq(times(hist.opposed, a2.id, b2.id));
  return sideGap(slice, mode) + W.spread * spreadOf(slice) + W.partner * repeatPartners + W.opponentDoubles * repeatOpponents;
}

// Decide the matches for one round.
//
// `must` always play (they have fewer games than everyone else in contention).
// `tier` are tied on games played; `k` of them get the remaining places. Which
// k is a free choice -- fairness is identical either way -- so the search uses
// it to build tighter, more even matches, while a penalty keeps anyone who sat
// out last round from sitting out again.
function assignRound(must, tier, k, mode, m, hist, rng, W, satLast) {
  const ppm = PER_MATCH[mode];
  const costOf = (slots, mi) => matchCost(slots.slice(mi * ppm, mi * ppm + ppm), mode, hist, W);
  const tierIds = new Set(tier.map((p) => p.id));
  const benchPenalty = (bench) => bench.reduce((n, p) => n + (satLast(p) ? W.rest : 0), 0);
  let best = null;

  for (let restart = 0; restart < RESTARTS; restart++) {
    // Restart 0 keeps the rested-longest-plays-first order; later restarts try
    // other subsets of the tied players for diversity.
    const ordered = restart === 0 || tier.length === k ? tier.slice() : shuffle(tier.slice(), rng);
    const bench = ordered.slice(k);
    // Start from "sort by rating, chunk into matches" (with jitter) -- already
    // close to competitive -- and let the swaps fix variety. The last restart
    // starts fully random so we don't get stuck in one basin.
    let slots = [...must, ...ordered.slice(0, k)]
      .map((p) => ({ p, k: p.rating + (rng() - 0.5) * (restart === 0 ? 40 : 160) }))
      .sort((x, y) => y.k - x.k)
      .map((x) => x.p);
    if (restart === RESTARTS - 1) slots = shuffle(slots, rng);

    const costs = Array.from({ length: m }, (_, mi) => costOf(slots, mi));

    for (let it = 0; it < ITERATIONS; it++) {
      // Sometimes try swapping an on-court tied player for a benched one.
      if (bench.length > 0 && rng() < 0.35) {
        const i = (rng() * slots.length) | 0;
        if (!tierIds.has(slots[i].id)) continue;
        const bi = (rng() * bench.length) | 0;
        const mi = (i / ppm) | 0;
        const out = slots[i];
        const inn = bench[bi];
        slots[i] = inn;
        const ci = costOf(slots, mi);
        const delta = ci - costs[mi] + (satLast(out) ? W.rest : 0) - (satLast(inn) ? W.rest : 0);
        if (delta <= 0) {
          costs[mi] = ci;
          bench[bi] = out;
        } else {
          slots[i] = out;
        }
        continue;
      }

      const i = (rng() * slots.length) | 0;
      const j = (rng() * slots.length) | 0;
      const mi = (i / ppm) | 0;
      const mj = (j / ppm) | 0;
      if (i === j || (mode === "singles" && mi === mj)) continue;

      [slots[i], slots[j]] = [slots[j], slots[i]];
      const ci = costOf(slots, mi);
      const cj = mi === mj ? 0 : costOf(slots, mj);
      const delta = ci + cj - costs[mi] - (mi === mj ? 0 : costs[mj]);
      if (delta <= 0) {
        costs[mi] = ci;
        if (mi !== mj) costs[mj] = cj;
      } else {
        [slots[i], slots[j]] = [slots[j], slots[i]]; // worse: undo
      }
    }

    const total = costs.reduce((x, y) => x + y, 0) + benchPenalty(bench);
    if (!best || total < best.total) best = { slots: slots.slice(), bench: bench.slice(), total };
  }
  return best;
}

function buildOnce(players, mode, courts, rng, W) {
  const ppm = PER_MATCH[mode];
  const m = Math.min(courts, Math.floor(players.length / ppm));
  const played = new Map(players.map((p) => [p.id, 0]));
  const lastPlayed = new Map(players.map((p) => [p.id, -1]));
  const hist = { partnered: new Map(), opposed: new Map() };
  const rounds = [];
  let totalCost = 0;

  for (let r = 0; r < ROUNDS; r++) {
    // 1. who is in contention: fewest games first, then longest rest, then a
    //    seeded coin-flip. Players strictly behind the cut-off must play;
    //    those level with it (the "tier") compete for the remaining places;
    //    those ahead of it sit.
    const order = players
      .map((p) => ({ p, tie: rng() }))
      .sort(
        (a, b) =>
          played.get(a.p.id) - played.get(b.p.id) || lastPlayed.get(a.p.id) - lastPlayed.get(b.p.id) || a.tie - b.tie
      )
      .map((o) => o.p);
    const places = m * ppm;
    const cutoff = played.get(order[places - 1].id);
    const must = order.filter((p) => played.get(p.id) < cutoff);
    const tier = order.filter((p) => played.get(p.id) === cutoff);
    const ahead = order.filter((p) => played.get(p.id) > cutoff);
    const satLast = (p) => r > 0 && lastPlayed.get(p.id) !== r - 1;

    // 2. who plays whom (and which of the tied players get the places)
    const { slots, bench, total } = assignRound(must, tier, places - must.length, mode, m, hist, rng, W, satLast);
    totalCost += total;
    const on = slots;
    const sitting = [...bench, ...ahead];

    const matches = [];
    for (let mi = 0; mi < m; mi++) {
      const slice = slots.slice(mi * ppm, mi * ppm + ppm);
      let a = mode === "singles" ? [slice[0]] : [slice[0], slice[1]];
      let b = mode === "singles" ? [slice[1]] : [slice[2], slice[3]];
      // present the side with the strongest player first, strongest first within a side
      const top = (side) => Math.max(...side.map((p) => p.rating));
      if (top(b) > top(a)) [a, b] = [b, a];
      a = [...a].sort((x, y) => y.rating - x.rating);
      b = [...b].sort((x, y) => y.rating - x.rating);

      if (mode === "doubles") {
        for (const side of [a, b]) {
          const k = pairKey(side[0].id, side[1].id);
          hist.partnered.set(k, (hist.partnered.get(k) || 0) + 1);
        }
      }
      for (const x of a) {
        for (const y of b) {
          const k = pairKey(x.id, y.id);
          hist.opposed.set(k, (hist.opposed.get(k) || 0) + 1);
        }
      }
      matches.push({
        a: a.map((p) => p.id),
        b: b.map((p) => p.id),
        gap: sideGap([...a, ...b], mode),
        spread: spreadOf([...a, ...b]),
        avg: [...a, ...b].reduce((s, p) => s + p.rating, 0) / ppm,
      });
    }

    // Court 1 is the strongest match, and so on down.
    matches.sort((x, y) => y.avg - x.avg);
    matches.forEach((mt, i) => {
      mt.court = i + 1;
      delete mt.avg;
    });

    for (const p of on) {
      played.set(p.id, played.get(p.id) + 1);
      lastPlayed.set(p.id, r);
    }
    rounds.push({
      index: r + 1,
      startMinute: r * SLOT_MINUTES,
      matches,
      sitting: sitting.map((p) => p.id),
    });
  }
  return { rounds, totalCost, courtsUsed: m };
}

// players: [{ id, name, rating? }]   mode: "singles" | "doubles"   courts: number
export function generateSchedule({ players, mode, courts, seed = 1, weights }) {
  const W = { ...DEFAULT_WEIGHTS, ...weights };
  const ppm = playersPerMatch(mode);
  if (!Array.isArray(players) || players.length < ppm) {
    throw new Error(`Need at least ${ppm} players for ${mode}`);
  }
  if (new Set(players.map((p) => p.id)).size !== players.length) {
    throw new Error("Players must be unique");
  }
  const normalised = players.map((p) => ({
    id: p.id,
    name: p.name,
    rating: Number.isFinite(p.rating) ? p.rating : DEFAULT_RATING,
  }));
  const wantCourts = Math.max(1, Math.floor(courts) || 1);

  let best = null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const rng = mulberry32((seed * 2654435761 + attempt * 7919) >>> 0);
    const built = buildOnce(normalised, mode, wantCourts, rng, W);
    if (!best || built.totalCost < best.totalCost) best = built;
  }

  const games = new Map(normalised.map((p) => [p.id, 0]));
  let gapSum = 0;
  let maxGap = 0;
  let matchCount = 0;
  for (const round of best.rounds) {
    for (const mt of round.matches) {
      for (const id of [...mt.a, ...mt.b]) games.set(id, games.get(id) + 1);
      gapSum += mt.gap;
      maxGap = Math.max(maxGap, mt.gap);
      matchCount++;
    }
  }
  const counts = [...games.values()];

  return {
    mode,
    seed,
    rounds: best.rounds,
    courtsUsed: best.courtsUsed,
    courtsRequested: wantCourts,
    perPlayer: Object.fromEntries(
      normalised.map((p) => [p.id, { games: games.get(p.id), byes: ROUNDS - games.get(p.id) }])
    ),
    summary: {
      rounds: ROUNDS,
      slotMinutes: SLOT_MINUTES,
      matches: matchCount,
      minGames: Math.min(...counts),
      maxGames: Math.max(...counts),
      avgGap: matchCount ? gapSum / matchCount : 0,
      maxGap,
    },
  };
}
