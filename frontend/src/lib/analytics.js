// Google Analytics 4 (free) -- usage, funnels and "what went wrong" signals.
//
// Off unless VITE_GA_MEASUREMENT_ID (G-XXXXXXXXXX) is set at build time, so
// local dev, previews and tests send nothing. Never put names, emails,
// passwords, tokens or free text in event params: only counts, enums, route
// *patterns* and short scrubbed error messages.
//
// The same site runs inside the Android app (a webview), so one tag covers
// both; the `platform` user property tells them apart.

const MEASUREMENT_ID = (import.meta.env?.VITE_GA_MEASUREMENT_ID || "").trim();

// ---- pure helpers (unit-tested in test-analytics.mjs) -----------------------

// "/groups/42/log/7" -> "/groups/:id/log/:id"; "/t/my-slug" -> "/t/:slug".
// Query strings (reset tokens!) and hashes are always dropped.
export function routePattern(pathname) {
  let p = String(pathname || "/").split(/[?#]/)[0];
  p = p.replace(/\/t\/[^/]+/, "/t/:slug");
  p = p.replace(/\/(\d+|[0-9a-f]{8}-[0-9a-f-]{27,})(?=\/|$)/gi, "/:id");
  return p || "/";
}

// API paths get the same treatment: "/groups/12/games" -> "/groups/:id/games".
export function endpointPattern(path) {
  return routePattern(path);
}

// Keep error text useful but harmless: no emails, no long digit runs, short.
export function scrubMessage(msg) {
  return String(msg ?? "")
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]")
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, "[token]")
    .replace(/\d{4,}/g, "#")
    .trim()
    .slice(0, 100);
}

// Which API calls are "business events" worth naming. Everything else only
// reports when it fails or is slow.
const API_EVENTS = [
  { method: "POST", re: /^\/auth\/signup$/, ok: "sign_up", fail: "sign_up_failed" },
  { method: "POST", re: /^\/auth\/login$/, ok: "login", fail: "login_failed" },
  { method: "POST", re: /^\/auth\/forgot-password$/, ok: "password_reset_requested", fail: "password_reset_request_failed" },
  { method: "POST", re: /^\/auth\/reset-password$/, ok: "password_reset_done", fail: "password_reset_failed" },
  { method: "POST", re: /^\/groups$/, ok: "group_created", fail: "group_create_failed" },
  { method: "POST", re: /^\/groups\/[^/]+\/members$/, ok: "member_added", fail: "member_add_failed" },
  { method: "POST", re: /^\/groups\/[^/]+\/games$/, ok: "game_logged", fail: "game_log_failed" },
  { method: "PATCH", re: /^\/games\/[^/]+$/, ok: "game_edited", fail: "game_edit_failed" },
  { method: "POST", re: /^\/groups\/[^/]+\/tournaments$/, ok: "tournament_created", fail: "tournament_create_failed" },
];

export function apiEventFor(method, path) {
  const clean = String(path || "").split("?")[0];
  const hit = API_EVENTS.find((e) => e.method === method && e.re.test(clean));
  if (hit) return hit;
  // schedule saves are PATCH /groups/:id with a body.schedule -- see api.js
  return null;
}

export const SLOW_MS = 4000;

export function platformName(ua = "") {
  // Android System WebView (the APK) carries "; wv)" in its user agent.
  return /; wv\)|\bwv\b/.test(ua) && /Android/i.test(ua) ? "android_app" : "web";
}

// ---- runtime ----------------------------------------------------------------

let ready = false;
let errorBudget = 10; // js_error events per page load, so a loop can't flood GA
const seenForms = new Set();

function gtag() {
  window.dataLayer.push(arguments);
}

export function analyticsEnabled() {
  return ready;
}

export function initAnalytics() {
  if (ready || !MEASUREMENT_ID || typeof window === "undefined") return;
  if (navigator.doNotTrack === "1") return;

  window.dataLayer = window.dataLayer || [];
  gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  gtag("js", new Date());
  const debug = new URLSearchParams(window.location.search).get("ga_debug") === "1";
  gtag("config", MEASUREMENT_ID, {
    send_page_view: false, // we send our own on route change
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    ...(debug ? { debug_mode: true } : {}),
  });
  gtag("set", "user_properties", { platform: platformName(navigator.userAgent) });

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.appendChild(s);
  ready = true;

  window.addEventListener("error", (e) => trackJsError(e.message));
  window.addEventListener("unhandledrejection", (e) =>
    trackJsError(e.reason?.message || String(e.reason || "unhandled rejection"))
  );
  // First touch of any form field = "started the form" -> drop-off before submit.
  document.addEventListener("focusin", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement) || !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
    const page = routePattern(window.location.pathname);
    if (seenForms.has(page)) return;
    seenForms.add(page);
    track("form_start", { page });
  });
}

export function track(name, params = {}) {
  if (!ready) return;
  gtag("event", name, params);
}

export function trackPage(pathname, title) {
  if (!ready) return;
  const page = routePattern(pathname);
  seenForms.delete(page); // a fresh visit can start the form again
  gtag("event", "page_view", {
    page_path: page,
    page_location: window.location.origin + page,
    page_title: title || document.title,
  });
}

export function identify(user) {
  if (!ready) return;
  if (!user) {
    gtag("set", { user_id: undefined });
    return;
  }
  // Internal id only -- never email or name. Lets GA join the web + app visits.
  gtag("set", { user_id: `u${user.id}` });
  gtag("set", "user_properties", { role: user.isAdmin ? "super_admin" : "member" });
  // Lets you exclude your own testing with a GA "internal traffic" data filter.
  if (user.isAdmin) gtag("set", { traffic_type: "internal" });
}

export function trackJsError(message) {
  if (!ready || errorBudget <= 0) return;
  errorBudget -= 1;
  track("js_error", { page: routePattern(window.location.pathname), message: scrubMessage(message) });
}

// An error the *user saw* on screen (server message or form validation).
export function trackUiError(message) {
  if (!ready) return;
  track("ui_error", { page: routePattern(window.location.pathname), message: scrubMessage(message) });
}

// Called by api.js after every request.
export function trackApi({ method, path, status, ms, networkError, scheduleChange }) {
  if (!ready) return;
  const endpoint = endpointPattern(String(path).split("?")[0]);
  const ok = !networkError && status >= 200 && status < 300;

  let named = apiEventFor(method, path);
  if (!named && scheduleChange) {
    named = { ok: scheduleChange === "clear" ? "schedule_cleared" : "schedule_saved", fail: "schedule_save_failed" };
  }
  if (named) track(ok ? named.ok : named.fail, ok ? { ms: Math.round(ms) } : { status: status || 0, endpoint });

  // Failures: skip the expected logged-out probe (/auth/me 401) and anything
  // already reported by name above (those carry status + endpoint themselves).
  if (!ok && !(endpoint === "/auth/me" && status === 401) && !named) {
    track("api_error", {
      endpoint,
      method,
      status: status || 0,
      kind: networkError ? "network" : status >= 500 ? "server" : "client",
    });
  }
  // Slow calls (cold serverless start, slow DB) feel like "the app is stuck".
  if (ok && ms >= SLOW_MS) track("api_slow", { endpoint, method, ms: Math.round(ms) });
}
