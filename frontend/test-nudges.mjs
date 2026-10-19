// Unit tests for the first-run nudge rules (no browser).
import assert from "node:assert/strict";
import { setupProgress, pickGroupNudge, showOweTip } from "./src/lib/nudges.js";

let n = 0;
const t = (name, fn) => { fn(); n++; };
const none = () => false;
const only = (...names) => (x) => names.includes(x);
const base = { role: "owner", memberCount: 1, totalGames: 0, hasExpenses: false, plannedEver: false, dismissed: none };

t("setupProgress counts steps from real data", () => {
  let p = setupProgress({ memberCount: 1, totalGames: 0, hasExpenses: false });
  assert.equal(p.doneCount, 1); assert.equal(p.current, "players");
  p = setupProgress({ memberCount: 4, totalGames: 0 });
  assert.equal(p.doneCount, 2); assert.equal(p.current, "game");
  p = setupProgress({ memberCount: 4, totalGames: 3, hasExpenses: true });
  assert.equal(p.doneCount, 4); assert.equal(p.current, null);
});
t("owner of a new group gets the checklist until players + a game exist", () => {
  assert.equal(pickGroupNudge(base), "checklist");
  assert.equal(pickGroupNudge({ ...base, memberCount: 4 }), "checklist");
  assert.equal(pickGroupNudge({ ...base, memberCount: 4, totalGames: 1 }), "next:cost");
});
t("then one next step at a time, each dismissable", () => {
  const ok = { ...base, memberCount: 4, totalGames: 2 };
  assert.equal(pickGroupNudge({ ...ok, dismissed: only("next:cost") }), "next:plan");
  assert.equal(pickGroupNudge({ ...ok, hasExpenses: true }), "next:plan");
  assert.equal(pickGroupNudge({ ...ok, hasExpenses: true, plannedEver: true }), null);
  assert.equal(pickGroupNudge({ ...ok, dismissed: only("next:cost", "next:plan") }), null);
});
t("dismissing the checklist skips straight to next steps", () => {
  assert.equal(pickGroupNudge({ ...base, dismissed: only("checklist") }), "next:cost");
});
t("admins get the same path; members get a welcome once, only if new", () => {
  assert.equal(pickGroupNudge({ ...base, role: "admin" }), "checklist");
  const m = { ...base, role: "member", memberCount: 6, totalGames: 20 };
  assert.equal(pickGroupNudge(m), "welcome");
  assert.equal(pickGroupNudge({ ...m, hasPlayed: true }), null, "regulars don't get a welcome");
  assert.equal(pickGroupNudge({ ...m, dismissed: only("welcome") }), null);
  assert.equal(pickGroupNudge({ ...m, role: "viewer" }), null);
});
t("Owe tip: once, never alongside another nudge", () => {
  assert.equal(showOweTip({ role: "member", groupNudge: "welcome", dismissed: none }), false);
  assert.equal(showOweTip({ role: "member", groupNudge: null, dismissed: none }), true);
  assert.equal(showOweTip({ role: "member", groupNudge: null, dismissed: only("owe-tip") }), false);
  assert.equal(showOweTip({ role: "owner", groupNudge: null, hasExpenses: true, dismissed: none }), false);
  assert.equal(showOweTip({ role: "owner", groupNudge: null, hasExpenses: false, dismissed: none }), true);
});
console.log(`nudges: ${n} test groups passed`);
