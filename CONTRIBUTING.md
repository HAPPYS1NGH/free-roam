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

Every push to `main` that touches the site also deploys it to IPFS at [freeroam.happysingh.eth.limo](https://freeroam.happysingh.eth.limo) (`.github/workflows/ipfs.yml`). Omnipin pins the build to Pinata, then to Lighthouse when that key is set. `site/scripts/publish-ens.mjs` then points the Namespace offchain subname `freeroam.happysingh.eth` at the new CID, keeping its other records. Each run keeps the CAR file as an artifact for 90 days, so any pinning service can restore that exact CID. Repository secrets: `PINATA_JWT`, `NAMESPACE_API_KEY` and, optionally, `LIGHTHOUSE_API_KEY`.

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

`scripts/release.sh` makes `dist/Free Roam-<version>.dmg` and a `.sha256` checksum. The version comes from `CFBundleShortVersionString` in `Sources/FreeRoam/Info.plist`. The build number is the commit count.

You need, once per Mac:

- The Developer ID Application certificate for team R5NM7593WP in your login keychain.
- A notarytool keychain profile called `freeroam-notary`: `xcrun notarytool store-credentials freeroam-notary`, with an app-specific password from account.apple.com. The credentials stay in the keychain.

Commit first. The script won't build with uncommitted changes to the app's files unless you set `ALLOW_DIRTY=1`. It:

1. Builds arm64 and x86_64 with `bundle.sh --release` and signs with Developer ID, the hardened runtime and `scripts/FreeRoam.entitlements`. That file has one entitlement, Apple Events, for Music. Screen Recording is a privacy permission and needs no entitlement.
2. Fails if the bundle has a file that isn't on its allowlist, a copy of anything in `site/public/library/`, `site/public/wallpaper/` or `site/public/sounds/local/`, or a `/Users/` path in the binary.
3. Notarizes and staples the app, so a copy dragged out of the DMG opens offline, then signs, notarizes and staples the DMG. If Apple rejects a submission, it prints Apple's log.
4. Writes the checksum.

Then check:

```sh
spctl -a -vvv -t install "dist/Free Roam-0.1.0.dmg"   # source=Notarized Developer ID
xcrun stapler validate "dist/Free Roam-0.1.0.dmg"
codesign --verify --deep --strict --verbose=2 "dist/Free Roam.app"
(cd dist && shasum -a 256 -c "Free Roam-0.1.0.dmg.sha256")
```

### Publish

The site and README link to `releases/latest/download/FreeRoam.dmg`, so every release must include the DMG under that exact name. Tag the commit the DMG was built from:

```sh
cp "dist/Free Roam-0.1.0.dmg" dist/FreeRoam.dmg
gh release create v0.1.0 --target <commit> --title "Free Roam 0.1.0" \
  dist/FreeRoam.dmg "dist/Free Roam-0.1.0.dmg" "dist/Free Roam-0.1.0.dmg.sha256"
```
