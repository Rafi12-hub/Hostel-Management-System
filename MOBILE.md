# Building the Mobile App (Android + iOS)

This project is wrapped with **Capacitor 8**. The web app (Vite build in `dist/`) is bundled into native iOS and Android projects. No React Native rewrite involved — the exact same React code runs in the native webview.

## Prerequisites

- **Android**: JDK 17+ (you have **Java 24** ✅), **Android Studio** (needed for the SDK + building APK/AAB — **not installed yet**)
- **iOS**: a **macOS machine with Xcode** (the `ios/` project is generated, but building IPAs requires a Mac — cannot be done on Windows)

## How it's configured

- `capacitor.config.ts` — app id `com.rgmcet.hostelportal`, name "RGM Hostel Portal", splash/status-bar branding, secure-context (`https://localhost`) for camera)
- Routing switched to **HashRouter** so deep links + native back button work in the webview
- `vite.config.ts` — `base: './'` so assets load from the packaged bundle
- Android `AndroidManifest.xml` — added `CAMERA` permission for face-api
- iOS `Info.plist` — added `NSCameraUsageDescription`
- Branded launcher icons + splash (indigo + RGMCET crest) generated into the native res folders
- `scripts/generate-app-icons.mjs` — regenerates icons/splash from `src/assets/crest.jpg`

## Build & deploy workflow

```bash
# 1. Build web + copy into the android/ios projects
npm run mobile:build        # = npm run build && npx cap copy

# 2. After changing native files (permissions, config), re-sync:
npx cap sync android

# 3. Re-generate icons/splash (after changing src/assets/crest.jpg)
npm run mobile:icons        # = node scripts/generate-app-icons.mjs
```

### Android — generate a debug APK

After installing **Android Studio** (and accepting SDK licenses), from the project root:

```bash
npm run android:apk         # builds android/build/outputs/apk/debug/app-debug.apk
```

Or GUI: `npm run android:open` then **Build ▸ Build Bundle(s) / APK(s) ▸ Build APK(s)**.

The APK lands at:
`android/app/build/outputs/apk/debug/app-debug.apk`

### Android — release (Play Store)

1. Install Android Studio, configure **Signing Config** (keystore), or let Studio generate a signed AAB.
2. `cd android && .\gradlew.bat bundleRelease`
3. Upload `android/app/build/outputs/bundle/release/app-release.aab` to Google Play Console.

### iOS — build on a Mac

```bash
npm run mobile:build
npx cap sync ios
npx cap open ios     # open in Xcode, then Run on simulator/device
```

App Store: set version/team in Xcode, then **Product ▸ Archive**.

## First-run data

There is **no auto-provisioning** anymore — a fresh install shows empty data and only logs in with accounts you create:
- Create the first **Admin** account in the Firebase Console (Authentication ▸ Users), then add a `User` doc with role `admin` in Firestore (or use the Admin SDK).
- Thereafter use the app's **User Management** page (warden/chief warden/admin) to create student & staff logins.

See `README.md` → Security model for the custom `role` claim requirement.

## Troubleshooting

- **Camera/face-recognition black screen**: ensure you're on Android 10+ and accepted the camera permission prompt; the app serves over `https://localhost` so `getUserMedia` is allowed.
- **Old web assets**: always run `npm run mobile:build` after editing React code — the native project copies from `dist/`.
- **Android Gradle/SDK errors**: in Android Studio, accept licenses via **Tools ▸ SDK Manager ▸ SDK Platforms**, then `sdkmanager --licenses`.