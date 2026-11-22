# Contributing

Found a bug? Open an [issue](https://github.com/HAPPYS1NGH/free-roam/issues/new/choose). Security problems go through [SECURITY.md](SECURITY.md) instead.

The repo has two parts:

- **The Mac app**: `Sources/`, `Tests/`, `Package.swift` and the build scripts in `scripts/`.
- **The website** at freeroam.happys1ngh.com: `site/`. It's a single page with a playable copy of the app's wheel.

Both read the wheel's numbers from `site/tokens.json` and its sounds from `assets/sounds/`.

## Mac app

```sh
scripts/make-signing-cert.sh   # once per Mac
scripts/bundle.sh --run        # builds dist/Free Roam.app and opens it
swift test
```

The certificate keeps the app's identity the same between builds, so macOS remembers its permissions. Without it, `bundle.sh` signs ad hoc and macOS forgets Screen Recording after every build.

The app was called Static until 2026-10-26. If you built it before then, quit Static, because it still answers ⌥Q, and remove it:

```sh
rm -rf dist/Static.app
tccutil reset All com.happys1ngh.static   # optional: forget its permissions
defaults delete com.happys1ngh.static     # optional: forget its stations
```

## Website

```sh
cd site
npm install
npm run dev     # then open /, hold Q, flick, let go
npm test
npm run build   # typecheck, build, prerender and release check
```

Only files listed in `site/scripts/public-assets.mjs` get into the build, so your exported library and wallpaper never ship. The release check fails on any built file that's a copy of one of them.

To deploy, run `SITE_URL=https://freeroam.happys1ngh.com npm run build:release` and publish only `site/dist/`. On Vercel, set the root directory to `site`, the build command to `npm run build:release`, the output directory to `dist`, and add the `SITE_URL` environment variable. `site/vercel.json` sets the headers and caching.

## Design studio

The tuning panel for the wheel runs locally and never ships.

```sh
cd site
npm run library     # optional: exports your Music playlists and art
npm run wallpaper   # optional: copies your desktop picture
npm run studio      # opens /studio.html
```

Studio mode serves `site/public/` as it is, personal exports included, so keep it local. It exports the settings to `site/tokens.json`, which the app reads.

## Brand assets

Everything comes from the badge, `site/public/free-roam/app-icon.png`, and the coast photo. `scripts/make-brand-assets.sh` regenerates the app icon, menu bar glyph, welcome badge, favicons, social card and launch images. Logo prompts are in `output/branding/free-roam/`.

## Release build

`scripts/release.sh` makes `dist/Free Roam-<version>.dmg`, a `.sha256` checksum, a copy named `dist/FreeRoam.dmg` and `dist/appcast.xml`, the feed Sparkle checks for updates. The version comes from `CFBundleShortVersionString` in `Sources/FreeRoam/Info.plist`. The build number is the commit count, and it's what Sparkle compares, so release from `main`.

You need, once per Mac:

- The Developer ID Application certificate for team R5NM7593WP in your login keychain.
- A notarytool keychain profile called `freeroam-notary`: `xcrun notarytool store-credentials freeroam-notary`, with an app-specific password from account.apple.com. The credentials stay in the keychain.
- Sparkle's EdDSA signing key in your login keychain, under the account `com.happys1ngh.freeroam`. Its public half is `SUPublicEDKey` in `Info.plist`. On a new Mac, import your backup with `.build/artifacts/sparkle/Sparkle/bin/generate_keys --account com.happys1ngh.freeroam -f <file>` (run `swift build` first to download the tool). Make the backup with `-x <file>` and keep it somewhere safe: without the key, nobody who installed Free Roam can be sent another update.

Commit first. The script won't build with uncommitted changes to the app's files unless you set `ALLOW_DIRTY=1`. It:

1. Builds arm64 and x86_64 with `bundle.sh --release`, embeds `Sparkle.framework` without its XPC services (only sandboxed apps need them), and signs Sparkle's helpers, then the app, with Developer ID, the hardened runtime and `scripts/FreeRoam.entitlements`. That file has one entitlement, Apple Events, for Music. Screen Recording is a privacy permission and needs no entitlement.
2. Fails if the bundle has a file that isn't on its allowlist (Sparkle's files are checked against the framework SwiftPM downloaded), a copy of anything in `site/public/library/`, `site/public/wallpaper/` or `site/public/sounds/local/`, or a `/Users/` path in the binary.
3. Notarizes and staples the app, so a copy dragged out of the DMG opens offline, then signs, notarizes and staples the DMG. If Apple rejects a submission, it prints Apple's log.
4. Writes the checksum, signs `FreeRoam.dmg` with the Sparkle key and writes `appcast.xml` with only this release in it.

Then check:

```sh
spctl -a -vvv -t install "dist/Free Roam-0.2.0.dmg"   # source=Notarized Developer ID
xcrun stapler validate "dist/Free Roam-0.2.0.dmg"
codesign --verify --deep --strict --verbose=2 "dist/Free Roam.app"
(cd dist && shasum -a 256 -c "Free Roam-0.2.0.dmg.sha256")
```

### Publish

The site and README link to `releases/latest/download/FreeRoam.dmg`, and the app reads `releases/latest/download/appcast.xml`. So every release must include both files under those exact names, and it must not be a pre-release, which `latest` skips. Tag the commit the DMG was built from:

```sh
gh release create v0.2.0 --target <commit> --title "Free Roam 0.2.0" \
  dist/FreeRoam.dmg dist/appcast.xml "dist/Free Roam-0.2.0.dmg" "dist/Free Roam-0.2.0.dmg.sha256"
```

Copies of 0.1.0 and earlier have no updater, so tell those people to download the new DMG once.
