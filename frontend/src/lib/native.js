// Small bridge to native iOS/Android niceties when the site runs inside the
// Capacitor app shell. The app loads this live site via server.url, and
// Capacitor injects its plugins at window.Capacitor.Plugins — so there is no
// npm dependency here, and everything is a harmless no-op in a normal browser.
const plugins = () => (typeof window !== "undefined" && window.Capacitor?.Plugins) || {};

export const isNativeApp = () =>
  typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();

/** kind: "tap" | "success" | "error" | "heavy" */
export function haptic(kind = "tap") {
  const h = plugins().Haptics;
  if (!h) return;
  try {
    if (kind === "success" || kind === "error") {
      h.notification?.({ type: kind === "success" ? "SUCCESS" : "ERROR" });
    } else {
      h.impact?.({ style: kind === "heavy" ? "HEAVY" : "LIGHT" });
    }
  } catch {
    /* ignore */
  }
}

export function initNative() {
  if (!isNativeApp()) return;
  document.documentElement.classList.add("native-app");
  try {
    plugins().StatusBar?.setStyle?.({ style: "DARK" }); // light text on our dark UI
  } catch {
    /* ignore */
  }
  // Light tap feedback on every button / nav link, like a native control.
  document.addEventListener(
    "click",
    (e) => {
      if (e.target instanceof Element && e.target.closest("button, a[href], [role='button']")) haptic("tap");
    },
    { passive: true }
  );
}

/** Scroll to the top of the page (the app column scrolls inside the native shell). */
export function scrollToTop() {
  document.getElementById("root")?.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
}
