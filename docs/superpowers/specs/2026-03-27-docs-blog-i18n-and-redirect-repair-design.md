# Docs + Blog + i18n + Redirect Repair Design

Date: 2026-03-27

## Summary

The current official docs site has four recurring classes of issues:

1. docs home does not surface the latest RL Training capability,
2. blog navigation/index does not consistently surface recent posts,
3. multi-locale content is inconsistent (en/zh/ja/ko drift),
4. link + redirect behavior is chaotic (wrong paths, wrong locale, old URLs break).

This spec defines a single coherent publishing contract that makes:

- English the source of truth for structure + slugs,
- all four locales fully synchronized for:
  - docs home,
  - blog index/navigation,
  - a fixed set of “core feature” posts (including RL Training),
- docs/blog cross-site links locale-correct,
- historical URLs backward compatible via redirect stubs (no new MkDocs redirect plugin).

Two key decisions are locked in (approved):

- Blog canonical posts live at the blog root (not under `blog/`).
- The docs build must not emit `/blog/*` routes (remove `docs-site/blog/*`).

## Problem

### A) Entry points are stale

- `docs-site/index.md` does not highlight the latest RL Training feature.
- `mkdocs.blog.yml` does not list recent posts under `Posts`, so users can miss them even if files exist.

### B) Content drifts by locale

The repository contains parallel trees for `en`, `zh`, `ja`, `ko`, but:

- home sections and content differ,
- blog indexes differ,
- some posts exist only in some locales.

### C) Published links are incorrect

Some markdown uses repository-relative links (example patterns):

- `docs-site/architecture.md`
- `docs/superpowers/specs/...`

These paths are not valid URLs on `cli.rexai.top`, leading to 404s or wrong-route navigation.

### D) `/blog` route collisions exist

Docs build:

- `mkdocs.yml` builds `docs-site/` into `site/`.
- If `docs-site/blog/*` exists, it emits `/blog/*` under `site/blog/*`.

Blog build:

- `mkdocs.blog.yml` builds `blog-site/` into `site/blog/`.

If both builds emit `/blog/*`, collisions or confusing behavior becomes inevitable.

## Goals

1. Make the RL Training feature visible from docs home in **all four locales**.
2. Make the blog index and nav include recent posts in **all four locales**.
3. Make `en` the source of truth for:
   - URL slugs,
   - home/index structure,
   - the “core content set” that must be translated for every release of content.
4. Eliminate `/blog/*` emission from the docs build to avoid collisions with the blog build.
5. Fix docs/blog cross-site links so they point to published URLs and preserve locale.
6. Add backward compatibility for historical URLs using redirect stub pages (no new redirect plugin dependency).
7. Add a synchronization gate so future updates cannot reintroduce drift silently.

## Non-Goals

1. Introducing a new documentation framework (keep MkDocs Material + mkdocs-static-i18n).
2. Auto-generating navigation from frontmatter across the entire site (manual nav is acceptable for now).
3. Designing a new visual theme; only minimal UI/structure changes needed for clarity and correctness.

## Canonical URL Contract

### Docs

- Docs EN: `/`
- Docs locales: `/zh/`, `/ja/`, `/ko/`

Docs is built from `mkdocs.yml` with `docs_dir: docs-site` and `site_dir: site`.

### Blog

- Blog EN: `/blog/`
- Blog locales: `/blog/zh/`, `/blog/ja/`, `/blog/ko/`

Blog is built from `mkdocs.blog.yml` with `docs_dir: blog-site` and `site_dir: site/blog`.

### Canonical Blog Post Location (Approved)

Canonical blog posts live at the blog root:

- EN: `blog-site/<slug>.md` -> `/blog/<slug>/`
- zh/ja/ko: `blog-site/<locale>/<slug>.md` -> `/blog/<locale>/<slug>/`

The repository may retain old paths (e.g. `blog-site/blog/<slug>.md`) only as redirect stubs.

## Content Source-of-Truth and Synchronization

### Source-of-Truth Rule

English is the canonical source for:

- which pages exist,
- the slug for each page/post,
- the home/index section structure,
- the set of “core feature” entries that must exist in every locale.

### Synchronization Rule (Approved)

For the defined core content set, all four locales must ship together:

- docs home (section structure + core feature links),
- blog home/index (section structure + core post list),
- core posts (full translated body for zh/ja/ko).

### “Core Content Set”

This spec defines a minimal core set that must be kept in sync. Initial required set:

- RL Training System
- ContextDB Search Upgrade (FTS5/BM25)
- Windows CLI Startup Stability Update
- Orchestrate Live: Subagent Runtime

The exact list is maintained in one canonical place (see Implementation Notes for the suggested registry file).

## Link and Navigation Rules

### Allowed Link Forms

- Docs internal: relative `.md` links (MkDocs resolves them per locale)
- Blog internal: relative `.md` links (MkDocs resolves them per locale)
- Docs <-> Blog cross links:
  - prefer site-root paths like `/blog/rl-training-system/`
  - or absolute URLs under `https://cli.rexai.top/...`

### Disallowed Link Forms (Must Remove)

Repository-relative links that are not valid on the published site, such as:

- `docs-site/...`
- `docs/...`
- `memory/...`
- any path that only exists in Git but not in `site/` output.

### Locale Preservation

Locale preservation has two layers:

1. Content must already include correct locale URLs for primary navigation surfaces.
2. Existing client-side link localization (in `docs-site/assets/analytics-placeholder.js` and `blog-site/assets/analytics-placeholder.js`) may rewrite `cli.rexai.top` links for non-EN paths; it must remain correct after this refactor.

In particular:

- Non-EN docs pages should link to `/blog/<locale>/...` when crossing to blog.
- Non-EN blog pages should link to `/<locale>/...` when crossing to docs.

## Redirect Strategy (No New Plugin)

### Requirement

Historical URLs should not 404, especially those created by earlier directory layouts.

### Approach

Use redirect stub markdown pages that render a short JS redirect and a fallback link.

Examples to support:

- Old: `/blog/blog/rl-training-system/` -> New: `/blog/rl-training-system/`
- Any other old nested blog paths created by `blog-site/blog/*`
- Any legacy docs-emitted blog pages (if they were indexed before removal of `docs-site/blog/*`)

### Redirect Stub Constraints

- Must be implemented inside the blog build output (prefer blog stubs).
- Must be locale-aware when an old locale path exists (e.g. `/blog/zh/blog/<slug>/` -> `/blog/zh/<slug>/`).

## Build Collision Elimination (Approved)

Docs must not emit `/blog/*` routes.

Action:

- Remove `docs-site/blog/*` from the docs tree.
- Any content previously placed there must be:
  - moved to `blog-site/` as canonical posts, or
  - replaced by redirect stubs in the blog tree as needed.

## Validation and Acceptance Criteria

### Acceptance Criteria

1. Docs home surfaces RL Training as latest core feature in EN/zh/ja/ko.
2. Blog nav and blog index surface the same core posts in EN/zh/ja/ko.
3. All core posts exist as fully translated content for zh/ja/ko.
4. No published page contains repo-relative broken links (`docs-site/...`, `docs/...`).
5. Docs <-> Blog cross links preserve locale (no “jump back to EN” surprises).
6. Old URLs (at minimum `/blog/blog/*`) redirect to the new canonical URLs.
7. Docs build does not emit any `/blog/*` content that competes with the blog build.

### Suggested Verification Commands

- Build docs: `mkdocs build -f mkdocs.yml --strict`
- Build blog: `mkdocs build -f mkdocs.blog.yml --strict`
- Grep output for broken paths:
  - `rg -n \"docs-site/|docs/superpowers|/blog/blog/\" site -S`
- Manual smoke:
  - open docs home in each locale
  - open blog home in each locale
  - click docs->blog and blog->docs links
  - open an old `/blog/blog/<slug>/` URL and confirm redirect

## Implementation Notes (Planned)

This spec intentionally does not prescribe exact patch steps; those will be written in the implementation plan.

However, the plan is expected to include:

- Re-home canonical blog posts into `blog-site/` root.
- Add/repair blog index pages per locale (`blog-site/index.md` and `blog-site/{zh,ja,ko}/index.md`) so they share the same core list.
- Update `mkdocs.blog.yml` nav to include the core posts explicitly for discoverability.
- Update `docs-site/index.md` and `docs-site/{zh,ja,ko}/index.md` to include the same “Latest / Core Features” section with RL highlighted.
- Remove `docs-site/blog/*` and move any needed content into blog canonical or stubs.
- Add redirect stub pages for historical paths.
- Add a synchronization check (script or gate) that fails if EN core content changes without corresponding locale updates.
