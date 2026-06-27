# Security Policy

Taviraq is early-stage software. Please report command safety, provider
privacy, key storage, SSH, or agent execution concerns with enough detail to
reproduce the behavior.

For public reports, use the Safety or security concern issue template and remove
API keys, tokens, private hostnames, customer data, and other secrets.

For product-level details, see:

- [Security and Privacy](docs/security-privacy.md)
- [Command Safety Eval](docs/safety-eval.md)
- [macOS Signing and Notarization](docs/signing-notarization.md)

## Dependency auditing

Taviraq ships Electron as a `devDependency` even though it is the runtime of
packaged builds, so the full dependency tree (not just production) is audited.

- **CI gate** (`.github/workflows/ci.yml`, "Audit dependencies" step):
  `npm audit --audit-level=high` runs on every pull request and on `main`/`master`
  pushes. The build fails on any `high` or `critical` advisory, including
  Electron-as-devDep advisories. `low`/`moderate` advisories do not fail CI but
  are expected to be cleared promptly.
- **Local check:** run `npm audit` (full tree) and `npm audit --omit=dev`
  (production only) before opening a PR.
- **Fixing advisories:** use `npm audit fix` (without `--force`). Never run
  `npm audit fix --force` on this repo — it can force major bumps of Electron or
  build tooling that break the packaged runtime.
- **Recurring updates:** Dependabot (`.github/dependabot.yml`) opens weekly
  grouped version-update PRs and immediate security-update PRs.
