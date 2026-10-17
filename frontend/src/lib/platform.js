// Which client is talking to us: the iPhone app, the Android app, or a browser.
// Pure and dependency-free so both the browser code and the serverless API
// (api/_lib/activity.js) share one definition.
//
// The phone apps load this same site inside a Capacitor shell, which reports
// its platform directly; the user-agent checks are only a fallback.

export const PLATFORMS = ["ios_app", "android_app", "web"];

export function platformName(ua = "", capacitorPlatform = "") {
  if (capacitorPlatform === "ios") return "ios_app";
  if (capacitorPlatform === "android") return "android_app";
  const s = String(ua || "");
  // Android System WebView (the APK) carries "; wv)" in its user agent.
  if (/; wv\)|\bwv\b/.test(s) && /Android/i.test(s)) return "android_app";
  // iOS WKWebView (the iPhone app) has no "Safari/" token; Safari and every
  // other iOS browser (CriOS, FxiOS, EdgiOS...) do.
  if (/\b(iPhone|iPad|iPod)\b/.test(s) && !/Safari\//.test(s)) return "ios_app";
  return "web";
}

// Server side: trust a well-formed X-Client-Platform header, else sniff the UA.
export function platformFromRequest(headers = {}) {
  const claimed = String(headers["x-client-platform"] || "").trim();
  if (PLATFORMS.includes(claimed)) return claimed;
  return platformName(headers["user-agent"] || "");
}
