# Contributing to Taviraq

Thanks for your interest in improving Taviraq! This guide covers how to propose
changes and the one-time agreement we need before we can merge external code.

## Contributor License Agreement (CLA)

Before your first pull request can be merged, you must sign the
[Taviraq Contributor License Agreement](CLA.md). It is a one-time step that lets the
project accept your contribution while keeping the freedom to license Taviraq under
additional terms in the future (including dual licensing).

Signing is automated — you do **not** need to email or send any document:

1. Open your pull request as usual.
2. The **CLA Assistant** bot will comment on the PR with a link to the CLA and a
   status check. If you have already signed, the check passes immediately.
3. If you have not signed yet, post the following as a **new comment** on the PR:

   ```
   I have read the CLA Document and I hereby sign the CLA
   ```

4. The bot records your signature and turns the check green. Future PRs from the same
   account are recognized automatically — you only sign once.

If the check is stuck, comment `recheck` to re-run it.

By signing, you agree to the terms in [CLA.md](CLA.md) for all of your current and
future contributions to this project.

## Development setup

```bash
npm install
npm run dev
```

See the [README](README.md#development) for the full local workflow, including the
bundled local secret scanner (`npm run prepare:gitleaks`).

## Before you open a pull request

Run the checks locally so CI passes on the first try:

```bash
npm run lint
npm run typecheck
npm test
```

## Commit and PR conventions

- Use [Conventional Commits](https://www.conventionalcommits.org/); keep the first
  line under 72 characters, in English, with no emojis.
- Keep each commit focused on one logical change.
- Write a clear PR description: what changed, why, and how you verified it. For UI
  changes, include before/after screenshots.

## Reporting bugs and requesting features

Use the issue templates under
[`.github/ISSUE_TEMPLATE`](.github/ISSUE_TEMPLATE). For anything touching command
execution, secret handling, or other security-sensitive behavior, please use the
**Safety / security concern** template.
