# NoExcuses — Android & iPhone apps

A Capacitor wrapper that opens the live site (https://www.noexcusesbadminton.com) in a
native Android shell with its own icon and splash screen. Because it loads the hosted
app, every web update shows up in the app automatically — no new APK needed.

## Get the APK
GitHub → **Actions → Build Android APK → Run workflow**, then download `NoExcuses.apk`
from the run's artifacts, or from the **android-latest** release.
On the phone: open the file, allow "Install unknown apps" for your browser/Files app, install.

## Build locally (Android Studio / JDK 21 + Android SDK)
    cd mobile && npm ci && npx cap sync android
    cd android && ./gradlew assembleDebug
    # APK: android/app/build/outputs/apk/debug/app-debug.apk

## Change the site URL or icon
- URL: `capacitor.config.json` → `server.url`
- Icon/splash: replace files in `resources/`, then `npm run assets`

## iPhone app (App Store / TestFlight)
Same idea: `ios/` is a Capacitor project that opens the live site. No Mac needed — GitHub builds it.
GitHub → **Actions → iOS build / TestFlight → Run workflow**. Without Apple secrets it just proves the
project compiles. With `APPLE_TEAM_ID`, `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID` and `APPSTORE_KEY_P8`
set (see the header of `.github/workflows/ios-testflight.yml`), a run on `main` signs the app and
uploads it to TestFlight. Store listing text, privacy answers and review notes: `IOS_APP_STORE.md`.

Native touches: haptic taps and a light-on-dark status bar (`frontend/src/lib/native.js`), a branded
offline screen, portrait iPhone only. After changing icons in `resources/`, run `npm run assets`.
