# SSH Test Cases

## TC-SSH-001: Create and save an SSH profile

- Priority: P1
- Type: UI, integration
- Sources: README, Settings Connections, `ssh:saveProfile`
- Coverage: partial
- Screenshot: none

Steps:
1. Open Settings > Connections.
2. Add a profile with host, user, port, and name.
3. Save and reopen Settings.

Expected:
- Profile is persisted in config.
- Saved profile appears in the Connections list.
- Empty optional fields do not produce invalid SSH arguments.

Automation:
- Existing: `tests/unit/ssh.test.ts` covers command generation.
- Missing: UI test for profile CRUD.

## TC-SSH-002: Validate SSH profile port

- Priority: P1
- Type: UI
- Sources: commit `e05bdb7`, Connections settings
- Coverage: missing
- Screenshot: none

Steps:
1. Open a new SSH profile form.
2. Enter a non-numeric port.
3. Try to save.
4. Enter a valid port and save.

Expected:
- Invalid port is rejected or visibly marked invalid.
- Valid port is accepted.
- Saved profile uses numeric port.

Automation:
- Existing: none.
- Missing: UI test for validation.

## TC-SSH-003: Choose identity file for SSH profile

- Priority: P1
- Type: Electron smoke, manual
- Sources: commit `5532e5d`, `ssh:chooseIdentityFile`
- Coverage: missing
- Screenshot: none

Steps:
1. Open Settings > Connections.
2. Click Browse for identity file.
3. Choose a test key file.
4. Save the profile.

Expected:
- File dialog accepts a file path.
- Identity file path is stored in the profile.
- Generated SSH command includes `-i`.

Automation:
- Existing: unit test for command generation.
- Missing: Electron smoke with mocked file dialog.

## TC-SSH-004: Start SSH session from new-tab dropdown

- Priority: P0
- Type: Electron smoke, manual
- Sources: README, issue #30, PR #41
- Coverage: missing
- Screenshot: TODO for dropdown state

Steps:
1. Save at least one SSH profile.
2. Open the new-tab dropdown.
3. Select the SSH profile.

Expected:
- A new SSH tab is created.
- Tab label shows useful profile/remote target context.
- Local terminal tab option remains available.

Automation:
- Existing: none.
- Missing: Electron smoke for dropdown profile launch.

## TC-SSH-005: Detect remote target from typed SSH command

- Priority: P1
- Type: unit
- Sources: `ssh.ts`, terminal manager tests
- Coverage: existing
- Screenshot: none

Steps:
1. Parse `ssh user@example.com`.
2. Parse `ssh -p 2222 -i ~/.ssh/key user@example.com`.

Expected:
- Remote target is extracted from simple and option-heavy commands.
- SSH options are skipped.
- Profile labels are preserved separately from remote target.

Automation:
- Existing: `tests/unit/ssh.test.ts`.
- Missing: none for parser; UI label smoke remains useful.

## TC-SSH-006: Reconnect a disconnected SSH session

- Priority: P1
- Type: UI, Electron smoke
- Sources: PR #41, `SessionStateSnapshot`, `App.tsx`
- Coverage: partial
- Screenshot: TODO for disconnected state

Steps:
1. Start an SSH session.
2. Simulate or wait for disconnection.
3. Click reconnect.

Expected:
- Session shows disconnected state before reconnect.
- Reconnect creates a new live PTY with the stored reconnect command.
- Previous output and assistant thread are remapped safely.

Automation:
- Existing: session state helper test backfills reconnect command.
- Missing: Electron smoke for reconnect UI.

## TC-SSH-007: SSH context increases command safety clarity

- Priority: P0
- Type: unit, UI
- Sources: docs/safety-eval.md, issue #30, command risk tests
- Coverage: partial
- Screenshot: none

Steps:
1. Activate an SSH session.
2. Ask agent mode to run a command that changes files.
3. Observe risk reason.

Expected:
- Confirmation explains that the active session is SSH.
- Remote impact is visible before approval.
- Command is not executed before confirmation.

Automation:
- Existing: `tests/unit/commandRisk.test.ts`.
- Missing: UI/Electron smoke for visible SSH risk reason.

