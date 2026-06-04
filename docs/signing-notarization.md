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

## Release Rule

Do not describe a build as trusted, signed, or notarized unless these checks pass
for the exact release artifact being published.
