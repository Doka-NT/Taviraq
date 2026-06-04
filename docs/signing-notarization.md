# macOS Signing and Notarization

Taviraq can be built unsigned for developer preview releases, or signed and
notarized for a trusted public release.

## Release builds (signed + notarized)

The GitHub release workflow (`.github/workflows/release.yml`) signs and notarizes
the `.zip` artifact using the repository secrets listed under **Signing Prep**.
The build config enables `hardenedRuntime`, applies `build/entitlements.mac.plist`,
and the workflow runs `electron-builder` with `-c.mac.notarize=true`, then verifies
the result with `codesign` / `spctl` / `stapler` before publishing.

## Local unsigned builds

Local packaging scripts set `CSC_IDENTITY_AUTO_DISCOVERY=false`, so they stay
unsigned even though signing config is present. Signing only happens when signing
credentials (`CSC_LINK`) are available, as in CI.

For local app installation without signing:

```bash
make install
```

For a full unsigned package build:

```bash
npm run package:mac:unsigned
```

## Signing Prep

For trusted releases, use an Apple Developer ID Application certificate for the
app bundle and a Developer ID Installer certificate when publishing `.pkg`
artifacts.

Recommended GitHub secrets:

- `CSC_LINK`: base64-encoded signing certificate archive
- `CSC_KEY_PASSWORD`: certificate password
- `APPLE_ID`: Apple ID used for notarization
- `APPLE_APP_SPECIFIC_PASSWORD`: app-specific password
- `APPLE_TEAM_ID`: Apple Developer Team ID

Signing is gated by credentials, not by config: without `CSC_LINK` /
`CSC_IDENTITY_AUTO_DISCOVERY=false`, builds do not enter `codesign`.

For an explicit local signed package build:

```bash
CSC_NAME="Developer ID Application: Example Team (TEAMID)"
npm run package:mac:signed
```

## Verification

After building a signed artifact, verify locally:

```bash
codesign --verify --deep --strict --verbose=2 "dist/mac/Taviraq.app"
spctl --assess --type execute --verbose "dist/mac/Taviraq.app"
```

After notarization and stapling:

```bash
xcrun stapler validate "dist/mac/Taviraq.app"
spctl --assess --type execute --verbose "dist/mac/Taviraq.app"
```

## Auto-update

Signed, notarized release builds update themselves through
[`electron-updater`](https://www.electron.build/auto-update). The release workflow
publishes a `latest-mac.yml` feed alongside the `.zip`, and the app reads it from
the GitHub Releases of `Doka-NT/Taviraq` (configured via `build.publish`).

- The updater only runs in a packaged macOS *release* build; it is a no-op in
  `npm run dev` and in local/unsigned packages (`package:mac:unsigned`), which keep
  the `0.0.0` placeholder version. Only the release workflow stamps a real version
  from the tag, so that version doubles as the "real release artifact" gate.
- On launch (and every six hours) the app checks the feed, downloads a newer signed
  build in the background, and shows an unobtrusive banner.
- Restarting is the user's choice; a staged update also installs on the next quit.
- macOS requires the build to be signed for Squirrel.Mac to apply the update, so
  auto-update depends on the signing setup above.

The release job fails if `latest-mac.yml` is missing from `dist/`, so a release can
never ship a `.zip` without its matching update feed.

## Release Rule

Do not describe a build as trusted, signed, or notarized unless these checks pass
for the exact release artifact being published.
