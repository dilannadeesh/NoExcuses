# NoExcuses — Android app

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
