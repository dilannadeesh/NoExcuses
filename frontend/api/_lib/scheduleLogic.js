// Validates a schedule posted by the group owner before it is stored for the
// whole group to see.
//
// The schedule is generated in the browser, so the server can't assume it is
// well-formed or honest. We check its shape and that every player really is a
// member of this group, then REBUILD everything derived from it (player names
// come from the database; the summary is recomputed from the rounds) and keep
// only the fields the app reads. A hostile or buggy client can therefore not
// get arbitrary names, ids or numbers shown to other members.

export const MAX_ROUNDS = 20;
export const MAX_PLAYERS = 100;
export const MAX_COURTS = 20;
export const MAX_BYTES = 80_000;
const PER_SIDE = { singles: 1, doubles: 2 };

const isInt = Number.isInteger;
const isNum = (n) => typeof n === "number" && Number.isFinite(n);
const fail = (error) => ({ ok: false, error });

function validDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// members: [{ id, name }] -- this group's members, from the database
export function validateSchedule(input, members) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return fail("schedule must be an object");
  let size;
  try {
    size = JSON.stringify(input).length;
  } catch {
    return fail("schedule is not valid JSON");
  }
  if (size > MAX_BYTES) return fail("schedule is too large");

  const { date, startTime, mode, courts, data } = input;
  if (!validDate(date)) return fail("date must be a real YYYY-MM-DD date");
  let start = null;
  if (startTime !== null && startTime !== undefined && startTime !== "") {
    if (typeof startTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
      return fail("startTime must be HH:MM (24-hour) or empty");
    }
    start = startTime;
  }
  if (!PER_SIDE[mode]) return fail('mode must be "singles" or "doubles"');
  if (!isInt(courts) || courts < 1 || courts > MAX_COURTS) return fail(`courts must be a whole number from 1 to ${MAX_COURTS}`);
  if (!data || typeof data !== "object") return fail("data is required");
  const perSide = PER_SIDE[mode];

  // ---- players: must be real members of THIS group; names come from the DB ----
  const memberName = new Map(members.map((m) => [m.id, m.name]));
  const rawPlayers = data.players;
  if (!Array.isArray(rawPlayers) || rawPlayers.length < perSide * 2 || rawPlayers.length > MAX_PLAYERS) {
    return fail(`players must list between ${perSide * 2} and ${MAX_PLAYERS} people`);
  }
  const players = [];
  const seen = new Set();
  for (const p of rawPlayers) {
    if (!p || !isInt(p.id)) return fail("every player needs a whole-number id");
    if (!memberName.has(p.id)) return fail("every player must be a member of this group");
    if (seen.has(p.id)) return fail("players must be unique");
    seen.add(p.id);
    players.push({ id: p.id, name: memberName.get(p.id), rating: isNum(p.rating) ? Math.round(p.rating) : 1000 });
  }

  // ---- rounds ----
  const sched = data.schedule;
  if (!sched || !Array.isArray(sched.rounds) || sched.rounds.length < 1 || sched.rounds.length > MAX_ROUNDS) {
    return fail(`schedule needs between 1 and ${MAX_ROUNDS} rounds`);
  }
  const rounds = [];
  const games = new Map(players.map((p) => [p.id, 0]));
  let matchCount = 0;
  let gapSum = 0;
  let maxGap = 0;
  let courtsUsed = 0;

  for (const [ri, r] of sched.rounds.entries()) {
    if (!r || !Array.isArray(r.matches) || !Array.isArray(r.sitting)) return fail(`round ${ri + 1} is malformed`);
    if (!isInt(r.startMinute) || r.startMinute < 0 || r.startMinute > 1440) return fail(`round ${ri + 1} has a bad start time`);
    if (r.matches.length > MAX_COURTS) return fail(`round ${ri + 1} has too many matches`);

    const inRound = new Set();
    const claim = (id, where) => {
      if (!seen.has(id)) return `round ${ri + 1}: ${where} lists someone who isn't in the player list`;
      if (inRound.has(id)) return `round ${ri + 1}: a player appears twice`;
      inRound.add(id);
      return null;
    };

    const courtNums = new Set();
    const matches = [];
    for (const m of r.matches) {
      if (!m || !isInt(m.court) || m.court < 1 || m.court > MAX_COURTS || courtNums.has(m.court)) {
        return fail(`round ${ri + 1} has a bad or repeated court number`);
      }
      courtNums.add(m.court);
      for (const side of [m.a, m.b]) {
        if (!Array.isArray(side) || side.length !== perSide || !side.every(isInt)) {
          return fail(`round ${ri + 1}: each side needs exactly ${perSide} player${perSide > 1 ? "s" : ""} for ${mode}`);
        }
      }
      for (const id of [...m.a, ...m.b]) {
        const problem = claim(id, "a match");
        if (problem) return fail(problem);
        games.set(id, games.get(id) + 1);
      }
      const gap = isNum(m.gap) && m.gap >= 0 ? m.gap : 0;
      const spread = isNum(m.spread) && m.spread >= 0 ? m.spread : 0;
      gapSum += gap;
      maxGap = Math.max(maxGap, gap);
      matchCount++;
      matches.push({ court: m.court, a: [...m.a], b: [...m.b], gap, spread });
    }
    for (const id of r.sitting) {
      if (!isInt(id)) return fail(`round ${ri + 1}: resting list is malformed`);
      const problem = claim(id, "the resting list");
      if (problem) return fail(problem);
    }
    // everybody is accounted for, exactly once: playing or resting
    if (inRound.size !== players.length) return fail(`round ${ri + 1} doesn't account for every player`);

    courtsUsed = Math.max(courtsUsed, matches.length);
    rounds.push({ index: ri + 1, startMinute: r.startMinute, matches, sitting: [...r.sitting] });
  }

  const counts = [...games.values()];
  const slot = isInt(sched.summary?.slotMinutes) && sched.summary.slotMinutes >= 1 && sched.summary.slotMinutes <= 60 ? sched.summary.slotMinutes : 12;

  return {
    ok: true,
    value: {
      date,
      startTime: start,
      mode,
      courts,
      payload: {
        schedule: {
          mode,
          seed: isInt(sched.seed) ? sched.seed : 0,
          rounds,
          courtsUsed,
          courtsRequested: courts,
          // recomputed from the rounds, never trusted from the client
          summary: {
            rounds: rounds.length,
            slotMinutes: slot,
            matches: matchCount,
            minGames: Math.min(...counts),
            maxGames: Math.max(...counts),
            avgGap: matchCount ? gapSum / matchCount : 0,
            maxGap,
          },
        },
        players,
      },
    },
  };
}
