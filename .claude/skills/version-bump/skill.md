---
name: version-bump
description: Cut a new ffix-roguelike release — bump every shippable app package.json in lockstep, write a CHANGELOG.md entry, commit with the changelog entry as the commit body, and push (when a remote exists).
---

# Version Bump

Cuts a new release of ffix-roguelike: bumps every shippable `apps/*` `package.json` in lockstep, writes a
`CHANGELOG.md` entry, commits with the changelog entry as the message body, and pushes. Ported from the
Airwave (ChannelGuide) / BasicTimeTracker golden-standard flow.

## Usage

```
/version-bump <patch|minor|major> <short-narrative>
```

Examples:
```
/version-bump patch fix ATB gauge drift under Haste
/version-bump minor add the Eiko unlock and summon command
/version-bump major change the save/progress schema
```

If the user just says "do a version bump" with no tier, infer it from the diff:

- **patch** (x.y.Z) — bug fix, copy tweak, dep bump, narrow refactor, a completed task during a build-out.
- **minor** (x.Y.0) — new feature, new surface, additive schema change.
- **major** (X.0.0) — breaking change, removed surface, incompatible schema.

**Exactly three segments. Never a fourth** (no `0.6.7.1`).

## The bump command (use this — don't hand-edit)

```
pnpm version:bump <patch|minor|major|X.Y.Z> [--dry-run]
```

It sets **every** `apps/*/package.json` version in lockstep (discovered, not hardcoded) with targeted edits,
**refuses to run** if they are out of sync, and `--dry-run` previews without writing. It edits version files
ONLY — you still write the CHANGELOG entry and commit (and never `git tag` unless James says so).

Internal `packages/*` stay at `0.0.0` (or unversioned). The root `package.json` is not bumped. No `v` prefix in
`package.json`.

## Instructions

1. **Read `CHANGELOG.md`** to find the most recent version (top entry).
2. **Determine the new version** from the requested tier and the previous version.
3. **Confirm the current version + sync** with `pnpm version:bump <tier> --dry-run`. If it reports a mismatch,
   STOP and tell James. Do not silently normalize.
4. **Inspect the diff** (`git status`, `git diff`, `git diff --staged`) to understand what's actually shipping.
5. **Draft the `## [X.Y.Z] - YYYY-MM-DD` entry**:

   ```markdown
   ## [X.Y.Z] - YYYY-MM-DD

   <one short paragraph framing what this release is about>

   ### Added / Changed / Fixed / Internal

   - <concrete changes — name files / surfaces / endpoints>
   ```

   Insert it at the top of the file, above the previous top entry.
6. **Show the user the proposed entry** before writing it, unless told to proceed autonomously.
7. **Apply:** `pnpm version:bump <tier|X.Y.Z>`, then write the `CHANGELOG.md` entry.
8. **Commit (and push if a remote exists):**
   - Stage the work + `CHANGELOG.md` + the bumped `apps/*/package.json` files.
   - Subject: `<type>: vX.Y.Z — <short narrative>` — `feat` (minor), `fix` (patch), `chore`/`refactor`/`docs`
     as appropriate. Lowercase after colon, imperative, ≤72 chars, em-dash between version and narrative.
   - Changelog entry as the message body, passed via HEREDOC.
   - `git push` to the tracked remote, if one is configured.
9. **Confirm** with the new version and commit hash.

## Cadence

During multi-task implementations, do a **patch bump + commit (+ push) after EACH completed task** — not
batched at the end.

## Do not

- Do NOT use `git commit --amend` to fold a bump into a prior commit unless asked.
- Do NOT hand-edit version files when `pnpm version:bump` can do it.
- Do NOT use `--no-verify`. Fix the underlying issue instead.
- Do NOT force-push `main`.
- Do NOT propose a fourth version segment.
- Do NOT `git tag` on your own initiative.
