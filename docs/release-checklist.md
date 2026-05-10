# Release Checklist

Use this checklist before public Taviraq releases.

## Build Trust

- App bundle name is `Taviraq.app` everywhere: README, release notes,
  screenshots, package names, and install commands.
- Release artifacts include SHA-256 checksums.
- macOS signing identity is configured when publishing a trusted release.
- Notarization credentials are configured when publishing a trusted release.
- `docs/signing-notarization.md` has been followed for trusted releases.
- Unsigned builds are clearly labeled as developer preview or test builds.

## Product Proof

- Demo media shows one local troubleshooting flow.
- Demo media shows one SSH troubleshooting flow.
- Demo media shows a risky command being paused before execution.
- `docs/security-privacy.md` matches the current storage and provider behavior.
- `docs/safety-eval.md` matches the current protected-command tests.
- `docs/comparison.md` matches the current positioning.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

For release packaging:

```bash
COPYFILE_DISABLE=1 npm exec -- electron-builder --mac zip --publish never
cd dist
shasum -a 256 *.zip > checksums.txt
shasum -a 256 -c checksums.txt
```

## Homebrew Cask Prep

Before submitting a cask, publish a notarized release archive and record:

- release tag
- archive URL
- SHA-256 checksum
- appcast or update story, if available
- minimum macOS version

The cask should install `Taviraq.app` and should not contain old `AI Terminal`
names.
