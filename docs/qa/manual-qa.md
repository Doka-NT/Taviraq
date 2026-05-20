# Taviraq Manual QA

Manual QA covers scenarios that need real macOS APIs, keychain access, SSH infrastructure, external providers, or packaged app behavior.

## macOS App Smoke

1. Launch Taviraq from source with `npm run dev`.
2. Confirm the app opens with a terminal tab and assistant sidebar.
3. Open and close Settings.
4. Open About, click homepage, and dismiss About with the documented controls.
5. Quit and relaunch the app.

Expected:
- No blank window.
- Terminal remains interactive.
- Window bounds and session restore behave according to settings.

## Keychain And Secrets

1. Add a provider with an API key.
2. Save and reopen Settings.
3. Confirm the API key is shown as saved, not as raw text.
4. Export data once without keys and once with keys.
5. Inspect both JSON files locally.

Expected:
- Raw keys are absent unless the user explicitly chooses to include them.
- Saved-key state survives restart.
- No secret appears in logs or config files.

## Real Provider Connectivity

Run one smoke scenario for each configured provider type available locally:

- OpenAI-compatible endpoint.
- Anthropic.
- Ollama.
- LM Studio.

Expected:
- Model list loads or produces a clear actionable error.
- Chat stream returns visible content.
- Cancellation stops the active stream.
- Provider setup feedback reflects success or failure.

## SSH

1. Add an SSH profile to a safe test host.
2. Connect from the new-tab dropdown.
3. Run `pwd` and `echo taviraq-ssh`.
4. Close/reconnect the session if possible.
5. Ask the assistant about recent SSH output in read mode.

Expected:
- Tab label shows useful remote context.
- SSH output is visible.
- Safety copy calls out remote impact where relevant.
- Reconnect does not corrupt terminal or chat state.

## Packaged App

1. Run `npm run package:mac:dir` on macOS.
2. Launch the generated `.app`.
3. Run a local terminal command.
4. Open Settings, About, and the assistant panel.
5. Verify bundled Gitleaks scanner behavior when secret masking is enabled.

Expected:
- Packaged app launches without stale renderer assets.
- Native modules load.
- Secret masking does not depend on development-only paths.

## Release Artifact

1. Build a ZIP through the release workflow or locally equivalent command.
2. Generate/check SHA-256 checksums.
3. Unzip and launch the app.
4. Follow README first-launch instructions for unsigned builds.

Expected:
- Archive checksum validates.
- App name and icon are correct.
- Unsigned-build warning is documented and recoverable.

