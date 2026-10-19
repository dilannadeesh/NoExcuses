// First-run nudges: which setup step a group is on, and which hints this
// person has already dismissed. Pure helpers are unit-tested in
// test-nudges.mjs; dismissals live in this browser only (a hint that comes
// back on a new phone is harmless), and every storage call is guarded.

export const SETUP_STEPS = [
  { id: "create", title: "Create the group" },
  { id: "players", title: "Add your players", body: "By name and email. 4 for doubles, 2 for singles. We'll email them an invite." },
  { id: "game", title: "Log your first game", body: "Set by set. The rankings start here." },
  { id: "cost", title: "Add the court fee", body: "Split it with whoever played. Optional." },
];

// What the group has done so far, from data the page already loads.
export function setupProgress({ memberCount = 0, totalGames = 0, hasExpenses = false }) {
  const done = {
    create: true,
    players: memberCount >= 2,
    game: totalGames > 0,
    cost: Boolean(hasExpenses),
  };
  const steps = SETUP_STEPS.map((s) => ({ ...s, done: done[s.id] }));
  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, total: steps.length, current: steps.find((s) => !s.done)?.id || null };
}

// Which group nudge to show, if any. Only one at a time.
//   "checklist"   owner/admin, until players are in and a game is logged
//   "next:cost"   then: add the court fee
//   "next:plan"   then: plan tonight's games (owner/admin)
//   "welcome"     a member's first visit
//   null          nothing
export function pickGroupNudge({ role, memberCount, totalGames, hasExpenses, plannedEver, hasPlayed = false, dismissed = () => false }) {
  const manages = role === "owner" || role === "admin";
  if (!manages) {
    // New to this group = hasn't played in it yet, so regulars never see it.
    if (role === "member" && !hasPlayed && !dismissed("welcome")) return "welcome";
    return null;
  }
  const p = setupProgress({ memberCount, totalGames, hasExpenses });
  const basicsDone = p.steps.find((s) => s.id === "players").done && p.steps.find((s) => s.id === "game").done;
  if (!basicsDone && !dismissed("checklist")) return "checklist";
  if (!hasExpenses && !dismissed("next:cost")) return "next:cost";
  if (!plannedEver && !dismissed("next:plan")) return "next:plan";
  return null;
}

// The Owe tooltip: once per person, never on top of another nudge, and not
// for an organiser whose group already splits costs.
export function showOweTip({ role, groupNudge, hasExpenses, dismissed = () => false }) {
  if (groupNudge || dismissed("owe-tip")) return false;
  if (role === "member") return true;
  return !hasExpenses;
}

// ---- per-browser memory ---------------------------------------------------

const KEY = "ne.nudges.v1";

function load() {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "{}") || {};
  } catch {
    return {};
  }
}

// Group-specific hints are keyed by group; the Owe tip is once per person.
const fullKey = (userId, groupId, name) => (name === "owe-tip" ? `${userId}:owe-tip` : `${userId}:${groupId}:${name}`);

export function isDismissed(userId, groupId, name) {
  return Boolean(load()[fullKey(userId, groupId, name)]);
}

export function dismiss(userId, groupId, name) {
  try {
    const all = load();
    all[fullKey(userId, groupId, name)] = Date.now();
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* private mode etc.: the hint just comes back next time */
  }
}
