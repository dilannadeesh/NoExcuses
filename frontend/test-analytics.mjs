// Unit tests for the analytics helpers (no browser, no network).
import assert from "node:assert/strict";
import { routePattern, scrubMessage, apiEventFor, platformName } from "./src/lib/analytics.js";

let n = 0;
const t = (name, fn) => { fn(); n++; };

t("routePattern masks ids, slugs, drops query/hash", () => {
  assert.equal(routePattern("/groups/42/log/7"), "/groups/:id/log/:id");
  assert.equal(routePattern("/groups/42/schedule"), "/groups/:id/schedule");
  assert.equal(routePattern("/t/my-secret-slug"), "/t/:slug");
  assert.equal(routePattern("/reset-password?token=abc123SECRET"), "/reset-password");
  assert.equal(routePattern("/tournaments/9#x"), "/tournaments/:id");
  assert.equal(routePattern("/"), "/");
  assert.equal(routePattern(""), "/");
  assert.equal(routePattern("/groups/3f2504e0-4f89-11d3-9a0c-0305e82c3301"), "/groups/:id");
  assert.equal(routePattern("/admin"), "/admin");
});
t("scrubMessage removes emails, tokens, long numbers, truncates", () => {
  assert.equal(scrubMessage("No account for bob@example.com"), "No account for [email]");
  assert.ok(!scrubMessage("tok abcdefghijklmnopqrstuvwxyz0123456789").includes("abcdefghij"));
  assert.equal(scrubMessage("order 123456 failed"), "order # failed");
  assert.equal(scrubMessage("x".repeat(500)).length <= 100, true);
  assert.equal(scrubMessage(undefined), "");
});
t("apiEventFor maps business calls only", () => {
  assert.equal(apiEventFor("POST", "/auth/signup").ok, "sign_up");
  assert.equal(apiEventFor("POST", "/auth/login").fail, "login_failed");
  assert.equal(apiEventFor("POST", "/groups").ok, "group_created");
  assert.equal(apiEventFor("POST", "/groups/12/games").ok, "game_logged");
  assert.equal(apiEventFor("PATCH", "/games/5").ok, "game_edited");
  assert.equal(apiEventFor("POST", "/groups/12/members").ok, "member_added");
  assert.equal(apiEventFor("GET", "/groups"), null);
  assert.equal(apiEventFor("GET", "/groups/12/games"), null);
  assert.equal(apiEventFor("POST", "/groups/12/games?x=1").ok, "game_logged");
});
t("platformName detects the Android webview", () => {
  assert.equal(platformName("Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36"), "android_app");
  assert.equal(platformName("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36"), "web");
  assert.equal(platformName("Mozilla/5.0 (Macintosh) Safari"), "web");
});
console.log(`analytics: ${n} test groups passed`);
