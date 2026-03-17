# Canonical Skill Source Tree Design

## Summary

Introduce a repository-level `skill-sources/` directory as the only canonical source of truth for project skills.

After this change:

- `skill-sources/<relative-skill-path>/` holds the maintained source files,
- `config/skills-catalog.json` points only to `skill-sources/...`,
- repo-local client skill roots become generated outputs from that canonical tree,
- cross-project and cross-machine installation copies skill content from `skill-sources/` by default instead of linking to repo-local absolute paths.

This corrects the current ambiguity where `.codex/skills` looks like both editable source and install output.

## Problem

The current repository structure mixes two different responsibilities into the same directories:

- source authoring,
- client discovery / install targets.

Today the install flow resolves skill sources from paths such as `.codex/skills/<skill>`. That creates several problems:

1. The source of truth is unclear.
2. Editing `.codex/skills` risks drifting from `.claude/skills`.
3. Cross-machine portability is weak because the current install behavior is link-oriented and depends on local absolute paths.
4. It is hard to reason about which directories are safe to edit manually and which should be generated.

The repository already moved to a catalog-driven selection model, but the source layout still reflects an earlier phase where client-facing directories doubled as authoring locations.

## Goals

1. Make one directory tree the explicit canonical source of repository skills.
2. Separate maintained source files from generated client-facing directories.
3. Make skill installation portable across projects and machines by default.
4. Keep existing client discovery semantics intact for Codex, Claude, and compatible consumers.
5. Add a predictable sync/check workflow so generated skill targets cannot silently drift.

## Non-Goals

1. Redesign superpowers installation.
2. Change the user-facing semantics of `global` vs `project` scope.
3. Remove repo-local client skill directories entirely.
4. Introduce packaging/distribution through npm, registries, or release bundles in this phase.
5. Force every client-specific variant into one shared markdown file when client-specific wording is genuinely needed.

## Current State

### Current layout

- `config/skills-catalog.json` defines installable skills.
- Most catalog `source` entries point at `.codex/skills/<skill>`.
- `.claude/skills/<skill>` duplicates many of the same skills.
- `.agents/skills/` exists as an additional compatibility directory for supported clients.
- install/update/uninstall/doctor operate from the catalog and currently use link-based install behavior.

### Current behavior mismatch

The repo now has a product model that distinguishes:

- install policy (`config/skills-catalog.json`),
- target scope (`global` / `project`),
- target client (`codex` / `claude` / others).

But it does not yet have a clean source model. As a result, the authoring story and the distribution story remain coupled.

## Options Considered

### Option 1: Keep `.codex/skills` as the source tree

Pros:

- minimal code churn,
- no migration needed.

Cons:

- source vs generated boundary stays ambiguous,
- `.claude/skills` duplication remains a maintenance trap,
- copy-based installation still has no clean canonical input tree.

### Option 2: Add `skill-sources/` as the canonical source tree

Pros:

- clear ownership model,
- installers and sync tools can read from one stable source,
- client-facing directories can become generated artifacts,
- cross-project and cross-machine copy flows become straightforward.

Cons:

- requires a migration,
- requires a sync/generation step for repo-local client directories.

### Option 3: Skip source-tree cleanup and move directly to packaged distribution

Pros:

- best long-term portability story.

Cons:

- too much change at once,
- does not solve the immediate authoring ambiguity cleanly,
- raises release/distribution concerns before source layout is stabilized.

## Recommended Approach

Adopt Option 2.

Introduce `skill-sources/` as the only maintained source tree. Treat `.codex/skills`, `.claude/skills`, and `.agents/skills` as generated compatibility targets. Change installer semantics so default installation uses recursive copy from `skill-sources/`, while link-based install is preserved only as an explicit development option.

## Canonical Layout

### Source tree

The repository should add:

```text
skill-sources/
  find-skills/
    SKILL.md
    references/
    assets/
    scripts/
  xhs-ops-methods/
    SKILL.md
  .system/
    skill-creator/
      SKILL.md
      references/
      clients/
        codex/SKILL.md
        claude/SKILL.md
```

Rules:

- The canonical source key is a relative skill path under `skill-sources/`, not just a flat skill name.
- Standard skills use `skill-sources/<skill>/`.
- Namespaced skills preserve their relative path, for example `skill-sources/.system/skill-creator/`.
- Every canonical skill directory must contain a complete shared base tree.
- `<canonical path>/SKILL.md` is required and is the default source for that skill path.
- Optional subdirectories such as `references/`, `assets/`, and `scripts/` live under the same skill directory.
- If a skill needs client-specific content, it may provide `clients/<client>/...` overrides.
- Authoring happens only under `skill-sources/`.
- Phase 1 does not support client-only skills with no shared base tree. If a skill truly diverges, it still needs a shared base directory and may fully replace selected files through the override layer.
- Generated output paths preserve the canonical relative path beneath each client root. Example:
  - `skill-sources/find-skills` -> `.codex/skills/find-skills`
  - `skill-sources/.system/skill-creator` -> `.codex/skills/.system/skill-creator`

### Generated compatibility targets

These directories remain in the repository because clients discover them there:

- `.codex/skills`
- `.claude/skills`
- `.agents/skills`
- `.gemini/skills`
- `.opencode/skills`

But after migration they are generated outputs, not hand-edited source locations.

For this design, repo-local compatibility generation preserves all currently supported project-local client roots that the installer/doctor flows already know about. There is no intentional de-scope for `gemini` or `opencode` in this migration.

### Client target matrix

| Client surface | Repo-local generated root | Global install root | Project install root | Policy |
|----------------|---------------------------|---------------------|----------------------|--------|
| Codex | `.codex/skills` | `~/.codex/skills` | `<repo>/.codex/skills` | Generated + installable |
| Claude | `.claude/skills` | `~/.claude/skills` | `<repo>/.claude/skills` | Generated + installable |
| Gemini | `.gemini/skills` | `~/.gemini/skills` | `<repo>/.gemini/skills` | Generated + installable |
| OpenCode | `.opencode/skills` | `~/.config/opencode/skills` | `<repo>/.opencode/skills` | Generated + installable |
| Agents compatibility | `.agents/skills` | none | none | Repo-local generated compatibility only; not part of `installContextDbSkills` client selection |

## Source Resolution Rules

For each catalog entry:

1. Resolve the canonical base path from `config/skills-catalog.json`.
2. Copy the full shared tree from the canonical path under `skill-sources/`, excluding the `clients/` subtree itself.
3. If a client-specific override exists for the requested client, recursively overlay `<canonical path>/clients/<client>/` onto the copied shared tree.

Recommended precedence:

1. `skill-sources/<skill>/`
2. `<canonical path>/clients/<client>/` overlay

Operational rule:

- base tree files are copied first,
- override files replace same-path files from the base tree,
- override files may also add client-specific `references/`, `assets/`, or `scripts/`,
- the `clients/` subtree is never emitted into generated targets or installed targets.

The first pass can keep this simple:

- shared skills use only the base directory,
- only known client-specific skills opt into per-client overrides.

## Sync Model

Add an explicit repository sync tool, for example:

- `scripts/sync-skills.mjs`

Its job is to fan out from `skill-sources/` into repo-local compatibility targets.

### Inputs

- `skill-sources/`
- optional client override directories
- optional `config/skills-catalog.json` validation input

### Outputs

- `.codex/skills/...`
- `.claude/skills/...`
- `.agents/skills/...`
- `.gemini/skills/...`
- `.opencode/skills/...`

### Generated artifact rules

Generated files and directories should use a managed marker strategy similar to the existing orchestrator-agent sync flow:

- managed outputs can be updated in place,
- managed outputs that are no longer expected can be removed,
- unmanaged files must never be overwritten silently,
- doctor/sync output should warn when unmanaged files block generation.

This allows safe regeneration without clobbering manual local files.

### Sync responsibility boundary

`sync-skills` is the writer for repo-local generated compatibility targets. It owns:

- enumerating canonical source entries from `skill-sources/`,
- rendering/copying from `skill-sources/`,
- updating managed repo-local generated outputs,
- removing stale managed repo-local generated outputs,
- warning on unmanaged blockers inside repo-local generated targets.

It does not manage user-home installs or external project installs.

It is not catalog-driven for source discovery. `config/skills-catalog.json` may be used only for validation, for example to warn when a canonical skill is discoverable in the repo but not installable through the catalog.

Ownership rule:

- Canonical skills present under `skill-sources/` are generated into repo-local client roots.
- Catalog membership controls installer exposure, not repo-local generation.
- Legacy discoverable skills that are not yet migrated into `skill-sources/` remain unmanaged and must be warned on rather than adopted silently.

## Installation Model

### Repository-local compatibility sync

Inside this repo, compatibility targets should be produced by the sync tool.

That means:

- developers edit `skill-sources/`,
- they run `sync-skills`,
- generated client-facing directories update accordingly.

### Cross-project and cross-machine installs

`installContextDbSkills` should change its default install mode from link to copy.

New default behavior:

1. Load catalog entries.
2. Resolve canonical source from `skill-sources/...`.
3. Materialize a temporary resolved tree using the same base-plus-overlay rules as `sync-skills`.
4. Recursively copy the resolved tree into the selected target root.
5. Write an install metadata file inside the installed skill directory.

Example targets:

- global:
  - `~/.codex/skills/<skill>`
  - `~/.claude/skills/<skill>`
  - `~/.gemini/skills/<skill>`
  - `~/.config/opencode/skills/<skill>`
- project:
  - `<repo>/.codex/skills/<skill>`
  - `<repo>/.claude/skills/<skill>`
  - `<repo>/.gemini/skills/<skill>`
  - `<repo>/.opencode/skills/<skill>`

### Optional development mode

Link-based install may still be useful for local authoring, but it should become explicit, for example:

- `--install-mode link`

That keeps development convenience without making portability-dependent behavior the default.

### Install metadata contract

Copy installs cannot rely on symlink identity, so managed installs need an explicit metadata contract.

Each installed skill directory should contain a small metadata file, for example:

- `<target>/<skill>/.aios-skill-install.json`

Minimum fields:

```json
{
  "schemaVersion": 1,
  "managedBy": "aios",
  "skillName": "find-skills",
  "client": "codex",
  "scope": "global",
  "installMode": "copy",
  "catalogSource": "skill-sources/find-skills",
  "generatedAt": "2026-03-17T00:00:00.000Z"
}
```

Contract:

- `doctor` uses this file to identify repo-managed copy installs,
- `uninstall` removes only targets whose metadata matches the expected skill/client/source,
- `force` replace is allowed only when the existing target is either absent or is a managed install for the same skill,
- unmanaged directories without this metadata are never replaced silently.

### Legacy link compatibility

Existing users may already have managed symlink installs that point at old repo-generated roots such as:

- `<repo>/.codex/skills/...`
- `<repo>/.claude/skills/...`
- `<repo>/.gemini/skills/...`
- `<repo>/.opencode/skills/...`

During migration, installer/doctor/uninstall must recognize these as legacy managed installs when all are true:

1. the target is still a symlink/junction,
2. the resolved path is under a previously generated repo-local client skill root for this repo,
3. the relative skill path maps to a canonical source entry in `skill-sources/`.

Legacy compatibility rule:

- `doctor` reports them as legacy-managed and recommends or performs replacement to copy mode,
- `update --force` may replace them with copy installs backed by install metadata,
- `uninstall` may remove them when the canonical relative skill path matches the requested skill.

## Catalog Changes

`config/skills-catalog.json` should continue to define install policy, but all `source` paths should point to `skill-sources/...`.

After migration the role split becomes:

- `skill-sources/`: canonical source tree
- `config/skills-catalog.json`: installable skill manifest and policy
- `.codex/skills`, `.claude/skills`, `.agents/skills`, `.gemini/skills`, `.opencode/skills`: generated compatibility outputs

This is the boundary the current repository is missing.

## Migration Plan

### Phase 1: Add canonical source tree

1. Create `skill-sources/`.
2. Copy existing maintained skills from `.codex/skills/...` into `skill-sources/...`.
3. Identify client-specific variants that should remain divergent.
4. Build a migration inventory for namespaced skills and unmanaged legacy client-only files.

### Phase 2: Add sync/generation

1. Implement `scripts/sync-skills.mjs`.
2. Generate `.codex/skills`, `.claude/skills`, `.agents/skills`, `.gemini/skills`, and `.opencode/skills` from `skill-sources/`.
3. Add managed markers and non-destructive update rules.
4. During rollout, `sync-skills` reads only `skill-sources/` plus explicit migration inventory; it does not depend on current catalog `source` values.

### Phase 3: Repoint install catalog

1. Update `config/skills-catalog.json` so `source` points to `skill-sources/...`.
2. Update tests to use canonical source-tree fixtures where appropriate.

### Phase 4: Switch installer default to copy

1. Add recursive copy behavior for skill installs.
2. Preserve link mode only behind an explicit option.
3. Add install metadata so uninstall and doctor still work against managed copy installs.

### Phase 5: Add drift checks and docs

1. Add `check-skills-sync` verification.
2. Document that `skill-sources/` is the only manual editing surface.
3. Document that client-facing skill roots are generated outputs.

### Migration inventory

The migration must classify existing skill-like content before generation takes ownership of repo-local client roots.

| Category | Example | Phase 1 disposition |
|----------|---------|---------------------|
| Cataloged shared skills | `find-skills`, `verification-loop` | Move into `skill-sources/<skill>/`, then generate all client targets from that source |
| Cataloged namespaced/system skills | `.codex/skills/.system/skill-creator` | Move into `skill-sources/.system/<skill>/`, keep namespaced relative path in generated outputs and catalog `source` |
| Cataloged client-specific variants | `skill-creator` if Codex/Claude bodies differ | Keep one shared base under `skill-sources/...`, add `clients/<client>/` overlay files only where needed |
| Canonical but non-installable repo-local skills | future repo-only skill under `skill-sources/...` but absent from catalog | Generate into repo-local targets, but exclude from installer selection and report as repo-only during validation |
| Uncataloged legacy client-only skills | `.claude/skills/baoyu-xhs-images/SKILL.md` | Leave unmanaged in phase 1, exclude from generated ownership, and emit sync/doctor warnings until migrated, cataloged, archived, or deleted |

This inventory keeps migration scope explicit and prevents the sync step from silently taking ownership of files it did not generate.

## Error Handling and Safety Rules

### Unmanaged files in generated targets

If sync sees an unmanaged file where it wants to generate output:

- do not overwrite it,
- emit a warning,
- continue with other files,
- keep doctor output actionable.

### Existing installs

If install targets already exist:

- copy mode should skip by default unless forced,
- force mode may replace only the selected managed target identified by symlink ownership or install metadata,
- doctor should report mismatches between expected source and installed target state.

### Tooling integration points

This migration requires explicit integration with existing repo controls:

- repo skill-root validation must recognize `skill-sources/` as the canonical source tree and must not warn on it as a non-discoverable rogue skill root,
- release packaging must include `skill-sources/` in shipped artifacts,
- release packaging or pre-release verification must run `check-skills-sync` so shipped generated roots are confirmed current,
- if packaged artifacts include generated client roots, packaging must run `sync-skills` before archiving.

### Client-specific divergence

If a skill legitimately needs client-specific wording:

- keep the override local to that skill,
- do not duplicate the whole tree unnecessarily,
- default to shared source unless divergence is justified.

## Testing and Verification

Minimum verification should cover:

1. Sync from `skill-sources/` creates expected repo-local compatibility outputs.
2. Sync updates managed outputs and skips unmanaged outputs.
3. Catalog entries resolve canonical source paths under `skill-sources/`.
4. Default install mode copies skill directories instead of linking them.
5. Explicit link mode still works for local development.
6. Doctor reports drift, unmanaged blockers, and generated-target mismatches clearly.

Recommended automated coverage:

- unit tests for source resolution precedence,
- unit tests for managed-output sync behavior,
- unit tests for copy vs link install modes,
- unit tests for install metadata recognition in doctor/uninstall,
- regression tests for `global` and `project` scope behavior.

## Operational Guidance

After this change, the day-to-day rule should be simple:

- edit `skill-sources/`,
- sync generated targets,
- verify no drift,
- then install or publish.

Repository docs should explicitly state:

- do not manually edit `.codex/skills`,
- do not manually edit `.claude/skills`,
- do not manually edit `.agents/skills`,
- do not manually edit `.gemini/skills`,
- do not manually edit `.opencode/skills`,
- these are generated compatibility directories.

## Command Boundaries

The commands should have distinct ownership:

- `sync-skills`: write and reconcile repo-local generated compatibility targets
- `check-skills-sync`: read-only verification that `skill-sources/` and generated repo-local targets are in sync
- `doctor-contextdb-skills`: inspect installed targets in user-home or project install roots and report managed/unmanaged drift

This keeps repo-local generation checks separate from end-user install diagnostics.

## Open Questions

1. Whether `check-skills-sync` should fail fast on the first mismatch or print a full diff summary first.
2. Whether generated repo-local targets should also carry a small sidecar metadata file in addition to in-file managed markers.

## Recommendation

Proceed with the canonical-source migration in the following order:

1. `skill-sources/`
2. repo-local sync generation
3. catalog repoint
4. copy-default installer
5. drift checks and docs

That sequence fixes the core structural problem first: one clear source of truth for skills.
