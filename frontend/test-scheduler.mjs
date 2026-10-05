// Run with: node test-scheduler.mjs
import { generateSchedule, ROUNDS, SLOT_MINUTES, maxCourts, estimateGames, DEFAULT_RATING } from "./src/lib/scheduler.js";

let failures = 0;
let passed = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    passed++;
  }
}
const ok = (msg) => console.log("ok:", msg);

const PPM = { singles: 2, doubles: 4 };
// ratings spread evenly from +spread/2 down to -spread/2 around `base`
const mkPlayers = (n, spread = 0, base = 1000) =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `P${i + 1}`,
    rating: Math.round(base + spread / 2 - (n > 1 ? (spread * i) / (n - 1) : 0)),
  }));

// ---------------------------------------------------------------------------
// 1. Validity: every combination produces a legal session
// ---------------------------------------------------------------------------
let runs = 0;
let validityOk = true;
let fairnessOk = true;
for (const mode of ["singles", "doubles"]) {
  for (let n = PPM[mode]; n <= 20; n++) {
    for (const courts of [1, 2, 3, 5]) {
      for (const seed of [1, 2, 3]) {
        runs++;
        const players = mkPlayers(n, 300);
        const s = generateSchedule({ players, mode, courts, seed });
        const expectMatches = Math.min(courts, maxCourts(n, mode));
        const ids = new Set(players.map((p) => p.id));

        if (s.rounds.length !== ROUNDS) validityOk = false;
        if (s.courtsUsed !== expectMatches) validityOk = false;
        s.rounds.forEach((r, ri) => {
          if (r.startMinute !== ri * SLOT_MINUTES) validityOk = false;
          if (r.matches.length !== expectMatches) validityOk = false;
          const seen = [];
          for (const mt of r.matches) {
            if (mt.a.length !== PPM[mode] / 2 || mt.b.length !== PPM[mode] / 2) validityOk = false;
            seen.push(...mt.a, ...mt.b);
          }
          seen.push(...r.sitting);
          // everybody appears exactly once per round, and only real players
          if (seen.length !== n || new Set(seen).size !== n || !seen.every((id) => ids.has(id))) validityOk = false;
          // courts are numbered 1..m with no gaps
          if (r.matches.map((x) => x.court).sort().join() !== r.matches.map((_, i) => i + 1).join()) validityOk = false;
        });
        if (s.summary.maxGames - s.summary.minGames > 1) fairnessOk = false;
      }
    }
  }
}
assert(validityOk, "every round is legal: right team sizes, no double-booking, nobody missing, courts numbered");
assert(fairnessOk, "game counts never differ by more than 1 between players");
ok(`validity + fairness across ${runs} generated sessions (singles/doubles, 2-20 players, 1-5 courts, 3 seeds)`);

// ---------------------------------------------------------------------------
// 2. Time: 2 hours of 12-minute slots
// ---------------------------------------------------------------------------
{
  const s = generateSchedule({ players: mkPlayers(8, 200), mode: "doubles", courts: 2 });
  assert(ROUNDS === 10 && SLOT_MINUTES === 12, "2 hours at 12 min = 10 rounds");
  assert(s.rounds[0].startMinute === 0 && s.rounds[9].startMinute === 108, "rounds start 0, 12, ... 108");
  assert(s.rounds[9].startMinute + SLOT_MINUTES === 120, "last round ends exactly at the 2-hour mark");
  ok("2-hour session = 10 rounds of 12 minutes");
}

// ---------------------------------------------------------------------------
// 3. Fewer players than courts, and not enough for the format
// ---------------------------------------------------------------------------
{
  const s = generateSchedule({ players: mkPlayers(9, 200), mode: "doubles", courts: 5 });
  assert(s.courtsUsed === 2 && s.courtsRequested === 5, "9 doubles players on 5 courts: only 2 courts can be filled");
  assert(s.rounds.every((r) => r.sitting.length === 1), "...and exactly 1 person rests each round");

  let threw = 0;
  for (const [n, mode] of [[1, "singles"], [0, "singles"], [3, "doubles"], [2, "doubles"]]) {
    try {
      generateSchedule({ players: mkPlayers(n), mode, courts: 1 });
    } catch {
      threw++;
    }
  }
  assert(threw === 4, "refuses to schedule when there aren't enough players for the format");
  let dupThrew = false;
  try {
    generateSchedule({ players: [{ id: 1, name: "a" }, { id: 1, name: "b" }], mode: "singles", courts: 1 });
  } catch {
    dupThrew = true;
  }
  assert(dupThrew, "refuses duplicate players");
  const clamped = generateSchedule({ players: mkPlayers(4), mode: "singles", courts: 0 });
  assert(clamped.courtsUsed === 1, "courts below 1 are treated as 1");
  const noRating = generateSchedule({ players: [{ id: 1, name: "a" }, { id: 2, name: "b" }], mode: "singles", courts: 1 });
  assert(noRating.rounds[0].matches[0].gap === 0, `players with no rating default to ${DEFAULT_RATING}`);
  ok("edge cases: courts > players allow, too few players rejected, duplicates rejected, missing ratings default");
}

// ---------------------------------------------------------------------------
// 4. Rest is shared out: nobody sits out two rounds running (when avoidable)
// ---------------------------------------------------------------------------
{
  let okRest = true;
  for (const [n, mode, courts] of [[9, "doubles", 2], [5, "singles", 2], [7, "doubles", 1], [11, "doubles", 2], [3, "singles", 1]]) {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = generateSchedule({ players: mkPlayers(n, 300), mode, courts, seed });
      for (const p of mkPlayers(n)) {
        for (let r = 1; r < ROUNDS; r++) {
          if (s.rounds[r].sitting.includes(p.id) && s.rounds[r - 1].sitting.includes(p.id)) okRest = false;
        }
      }
    }
  }
  assert(okRest, "nobody sits out two rounds in a row (9/5/7/11/3 players across formats)");
  ok("rest is rotated: no back-to-back sit-outs");
}

// ---------------------------------------------------------------------------
// 5. BALANCED + COMPETITIVE: measurably better than random pairing
// ---------------------------------------------------------------------------
function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function randomBaseline(players, mode, courts, trials = 4000) {
  const rng = lcg(12345);
  const ppm = PPM[mode];
  const m = Math.min(courts, maxCourts(players.length, mode));
  let gap = 0;
  let spread = 0;
  let count = 0;
  for (let t = 0; t < trials; t++) {
    const pool = [...players];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (let k = 0; k < m; k++) {
      const s = pool.slice(k * ppm, k * ppm + ppm).map((p) => p.rating);
      gap += mode === "singles" ? Math.abs(s[0] - s[1]) : Math.abs(s[0] + s[1] - s[2] - s[3]) / 2;
      spread += Math.max(...s) - Math.min(...s);
      count++;
    }
  }
  return { gap: gap / count, spread: spread / count };
}
function measured(s, ratingOf) {
  let gap = 0;
  let spread = 0;
  let n = 0;
  for (const r of s.rounds) {
    for (const mt of r.matches) {
      const ids = [...mt.a, ...mt.b];
      const rs = ids.map(ratingOf);
      gap += mt.gap;
      spread += Math.max(...rs) - Math.min(...rs);
      n++;
    }
  }
  return { gap: gap / n, spread: spread / n };
}
// Thresholds come from measurement, not guesswork. With variety switched off
// the best achievable is e.g. gap ~0 / spread ~170 (8 doubles) -- but that
// repeats the same partners every round, which is useless. With the shipped
// weights, balance beats random by 55-88% everywhere. Competitiveness (how
// close in level the players in a match are) improves by 15-47%: least when
// everyone plays every round (8 players, 2 courts), because there is then no
// choice about WHO plays and partners must rotate, which mixes levels.
const BALANCE_MAX_RATIO = 0.5; // gap must be under half of random
const COMPETITIVE_MAX_RATIO = 0.9; // spread must be under 90% of random
for (const [label, n, mode, courts, spreadPts] of [
  ["12 players doubles, 2 courts, wide skill range", 12, "doubles", 2, 500],
  ["10 players doubles, 2 courts", 10, "doubles", 2, 400],
  ["8 players doubles, 2 courts (nobody sits out)", 8, "doubles", 2, 400],
  ["12 players singles, 3 courts", 12, "singles", 3, 500],
]) {
  const players = mkPlayers(n, spreadPts);
  const rating = new Map(players.map((p) => [p.id, p.rating]));
  const base = randomBaseline(players, mode, courts);
  let gapSum = 0;
  let spreadSum = 0;
  const seeds = [1, 2, 3, 4, 5];
  for (const seed of seeds) {
    const m = measured(generateSchedule({ players, mode, courts, seed }), (id) => rating.get(id));
    gapSum += m.gap;
    spreadSum += m.spread;
  }
  const gap = gapSum / seeds.length;
  const spread = spreadSum / seeds.length;
  assert(gap < base.gap * BALANCE_MAX_RATIO, `${label}: rating gap ${gap.toFixed(1)} should be under ${BALANCE_MAX_RATIO}x random (${base.gap.toFixed(1)})`);
  assert(spread < base.spread * COMPETITIVE_MAX_RATIO, `${label}: level spread ${spread.toFixed(1)} should be under ${COMPETITIVE_MAX_RATIO}x random (${base.spread.toFixed(1)})`);
  ok(`${label}: gap ${gap.toFixed(0)} vs random ${base.gap.toFixed(0)} (${Math.round((1 - gap / base.gap) * 100)}% better)  |  spread ${spread.toFixed(0)} vs ${base.spread.toFixed(0)} (${Math.round((1 - spread / base.spread) * 100)}% better)`);
}

// ---------------------------------------------------------------------------
// 6. VARIETY: partners and opponents are spread out, not repeated
// ---------------------------------------------------------------------------
function repeats(s) {
  const partner = new Map();
  const opp = new Map();
  const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (const r of s.rounds) {
    for (const mt of r.matches) {
      if (mt.a.length === 2) {
        for (const side of [mt.a, mt.b]) partner.set(key(...side), (partner.get(key(...side)) || 0) + 1);
      }
      for (const x of mt.a) for (const y of mt.b) opp.set(key(x, y), (opp.get(key(x, y)) || 0) + 1);
    }
  }
  return { partner: Math.max(0, ...partner.values()), opp: Math.max(0, ...opp.values()), partnerPairs: partner.size };
}
{
  // 8 players, 2 courts, everyone plays every round: 40 partnerships over 28 possible pairs -> 2 is the floor
  let worstPartner = 0;
  let worstPartnerEqual = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    worstPartner = Math.max(worstPartner, repeats(generateSchedule({ players: mkPlayers(8, 400), mode: "doubles", courts: 2, seed })).partner);
    worstPartnerEqual = Math.max(worstPartnerEqual, repeats(generateSchedule({ players: mkPlayers(8, 0), mode: "doubles", courts: 2, seed })).partner);
  }
  assert(worstPartner <= 3, `8 doubles players (skilled spread): nobody partners the same person more than 3 times (worst ${worstPartner})`);
  assert(worstPartnerEqual <= 2, `8 doubles players (all equal): nobody partners the same person more than twice (worst ${worstPartnerEqual})`);
  ok(`doubles variety: worst partner repeat = ${worstPartner} (varied skills), ${worstPartnerEqual} (equal skills)`);

  let worstOpp = 0;
  for (const seed of [1, 2, 3, 4, 5]) {
    worstOpp = Math.max(worstOpp, repeats(generateSchedule({ players: mkPlayers(6, 300), mode: "singles", courts: 3, seed })).opp);
  }
  assert(worstOpp <= 3, `6 singles players on 3 courts: nobody faces the same opponent more than 3 times (worst ${worstOpp})`);
  ok(`singles variety: worst opponent repeat = ${worstOpp}`);

  // 4 players on one court can only form 3 different partnerships -- just make sure they rotate
  const four = repeats(generateSchedule({ players: mkPlayers(4, 200), mode: "doubles", courts: 1, seed: 1 }));
  assert(four.partner <= 4, `4 doubles players rotate partners (worst repeat ${four.partner} of 10 rounds)`);
  ok("4 players on one court still rotate partners");
}

// ---------------------------------------------------------------------------
// 7. Determinism + regenerate, estimate helper, speed
// ---------------------------------------------------------------------------
{
  const args = { players: mkPlayers(10, 300), mode: "doubles", courts: 2 };
  const a = JSON.stringify(generateSchedule({ ...args, seed: 7 }));
  const b = JSON.stringify(generateSchedule({ ...args, seed: 7 }));
  assert(a === b, "same seed gives the identical schedule");
  const variants = new Set([1, 2, 3, 4, 5].map((seed) => JSON.stringify(generateSchedule({ ...args, seed }).rounds)));
  assert(variants.size > 1, "different seeds give different schedules (so Regenerate actually changes something)");
  ok("deterministic per seed; Regenerate gives a different schedule");

  const e = estimateGames(9, "doubles", 2);
  assert(e.min === 8 && e.max === 9 && e.courtsUsed === 2, "estimate: 9 doubles players on 2 courts get 8-9 games");
  const real = generateSchedule({ players: mkPlayers(9, 200), mode: "doubles", courts: 2 });
  assert(real.summary.minGames === e.min && real.summary.maxGames === e.max, "the estimate shown before generating matches what you actually get");
  ok("estimate matches the real result");

  const t0 = Date.now();
  generateSchedule({ players: mkPlayers(24, 400), mode: "doubles", courts: 6, seed: 1 });
  const ms = Date.now() - t0;
  assert(ms < 1500, `24 players / 6 courts generates quickly (${ms} ms)`);
  ok(`largest realistic session generated in ${ms} ms`);
}

console.log(failures === 0 ? `\nALL PASSED (${passed} assertions)` : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
