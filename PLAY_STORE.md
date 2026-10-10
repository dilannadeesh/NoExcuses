# Releasing to Google Play

App id: `noexcusesbadminton.app` (must match the app in Play Console; it can never change after the first upload).
The app is a native shell around https://www.noexcusesbadminton.com, so web updates reach users without a new release.

## One-time setup
1. **Signing secrets** — GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
   `ANDROID_KEYSTORE_B64` (base64 of the upload keystore), `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS` (`noexcuses-upload`), `ANDROID_KEY_PASSWORD`.
2. **Support email** — Vercel → Environment Variables → `VITE_SUPPORT_EMAIL` (shown on the privacy / delete-account pages) → redeploy.
3. Run **Actions → Build Android APK → Run workflow**. With the secrets set it also produces `NoExcuses.aab`
   (artifact *NoExcuses-aab*). The `versionCode` is the workflow run number, so every build is higher than the last.

## Play Console checklist
- Create release → upload `NoExcuses.aab`; accept **Play App Signing** (Google keeps the real app-signing key; ours is only the upload key).
- Store listing: name, short + full description, icon 512×512 (`play-icon-512.png`), feature graphic 1024×500, ≥2 phone screenshots.
- App content: Privacy policy URL `https://www.noexcusesbadminton.com/privacy`; Data safety form; Content rating; Target audience (13+); Ads: **No**.
- Account deletion URL (Data safety → App access / Data deletion): `https://www.noexcusesbadminton.com/delete-account`.
- App access: provide a demo login for reviewers (an account that belongs to a group with a few games).
- Personal developer accounts created after Nov 2023: run a **closed test with ≥12 testers for 14 days** before Production access.

## Data safety answers (matches the privacy policy)
Collected: name, email, user id, app interactions, crash/diagnostic-style error info. Not sold. Encrypted in transit. Users can request deletion.
Shared with processors only (Vercel, Neon, Resend, Google Analytics). No location, contacts, photos, or ads.
