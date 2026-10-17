import { api } from "../api";
import { isNativeApp } from "./native";

// Push notifications in the phone app. Capacitor injects the plugin at
// window.Capacitor.Plugins, so this is a harmless no-op in a browser and in
// app builds that were made before the plugin was added.
// Android joins this list once the Android app ships with its Firebase config.
const PUSH_PLATFORMS = ["ios"];
const TOKEN_KEY = "ne_push_token";

const plugin = () => (typeof window !== "undefined" && window.Capacitor?.Plugins?.PushNotifications) || null;
const platform = () => window.Capacitor?.getPlatform?.();
const store = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (v) => {
    try {
      if (v) localStorage.setItem(TOKEN_KEY, v);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export const pushSupported = () => isNativeApp() && PUSH_PLATFORMS.includes(platform()) && !!plugin();

let goTo = null;
export const setPushNavigator = (fn) => {
  goTo = fn;
};

// Only ever open an in-app group screen, whatever the notification says.
const safeRoute = (r) => (typeof r === "string" && /^\/groups\/\d+(\/[a-z]+)*$/.test(r) ? r : null);

let listening = false;
async function listen() {
  if (listening) return;
  listening = true;
  const p = plugin();
  await p.addListener("registration", async ({ value }) => {
    try {
      await api.registerPushToken(value, platform());
      store.set(value);
    } catch {
      /* will retry next launch */
    }
  });
  await p.addListener("registrationError", () => {});
  await p.addListener("pushNotificationActionPerformed", (action) => {
    const route = safeRoute(action?.notification?.data?.route);
    if (route && goTo) goTo(route);
  });
}

/** Quietly (re)register this phone if the user already allowed notifications. */
export async function syncPush() {
  if (!pushSupported()) return;
  try {
    await listen();
    const { receive } = await plugin().checkPermissions();
    if (receive === "granted") await plugin().register();
  } catch {
    /* push is a nicety, never an error */
  }
}

/** Ask for permission (iOS shows its prompt once) and register. */
export async function enablePush() {
  if (!pushSupported()) return;
  try {
    await listen();
    let { receive } = await plugin().checkPermissions();
    if (receive === "prompt" || receive === "prompt-with-rationale") ({ receive } = await plugin().requestPermissions());
    if (receive === "granted") await plugin().register();
  } catch {
    /* ignore */
  }
}

/** Called on log out so this phone stops getting the old account's notifications. */
export async function unregisterPush() {
  const token = store.get();
  if (!token) return;
  try {
    await api.unregisterPushToken(token);
  } catch {
    /* best effort */
  }
  store.set(null);
}
