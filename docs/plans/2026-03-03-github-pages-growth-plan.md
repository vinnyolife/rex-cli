# GitHub Pages Growth System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a GitHub Pages documentation/growth site with MkDocs Material, then use SEO + community operations to drive qualified traffic to `cli.rexai.top`, `rexai.top`, and `tool.rexai.top`.

**Architecture:** Use a docs-as-website approach with MkDocs Material deployed by GitHub Actions to Pages. Keep product docs, SEO landing pages, and content operations in one versioned repo. Track funnel metrics from entry pages to target domains and iterate weekly.

**Tech Stack:** MkDocs Material, Python, GitHub Pages, GitHub Actions, DNS custom domain, optional Plausible/GA4 + Search Console + Bing Webmaster.

---

### Task 1: Define site structure and funnel

**Files:**
- Create: `docs/plans/2026-03-03-growth-information-architecture.md`
- Create: `docs/plans/2026-03-03-growth-kpi-baseline.md`

**Step 1: Lock core funnel pages**
- Home (project value + CTA), Docs, Use Cases, Blog bridge, Community bridge.

**Step 2: Map destination routing**
- Primary CTA to `cli.rexai.top`
- Secondary CTA to `tool.rexai.top`
- Content-depth CTA to `rexai.top`

**Step 3: Define weekly KPIs**
- Organic impressions, CTR, indexed pages, referring domains, X/community clicks, CTA conversion rate.

---

### Task 2: Build MkDocs Material + Pages deployment

**Files:**
- Create: `mkdocs.yml`
- Create: `.github/workflows/pages.yml`
- Create: `site/docs/index.md`
- Create: `site/docs/getting-started.md`
- Create: `site/docs/use-cases.md`
- Create: `site/docs/community.md`

**Step 1: Configure MkDocs Material**
- Navigation, theme, search, social cards, canonical URL.

**Step 2: Configure GitHub Pages deployment**
- Build in CI, upload artifact, deploy to Pages on `main`.

**Step 3: Add custom-domain instructions**
- Decide `docs.rexai.top` (recommended) or `rexai.top/docs`.

---

### Task 3: Implement SEO baseline (technical + on-page)

**Files:**
- Create: `site/docs/seo/keyword-map.md`
- Create: `site/docs/seo/content-clusters.md`
- Create: `site/docs/seo/programmatic-page-template.md`
- Modify: `mkdocs.yml`

**Step 1: Technical SEO**
- `robots.txt`, `sitemap.xml`, canonical tags, structured data, OpenGraph/Twitter cards.

**Step 2: On-page SEO**
- Title/H1/meta descriptions for each landing page.
- Internal links between docs and the three target domains.

**Step 3: Search platform setup**
- Google Search Console and Bing Webmaster verification.

---

### Task 4: Content engine for traffic

**Files:**
- Create: `site/docs/blog/index.md`
- Create: `site/docs/blog/launch-post.md`
- Create: `site/docs/blog/cli-comparison-post.md`
- Create: `site/docs/blog/automation-playbook-post.md`
- Create: `docs/plans/2026-03-03-content-calendar-8-weeks.md`

**Step 1: Publish seed articles**
- 3 pillar posts targeting discovery keywords.

**Step 2: Build interlinking**
- Each article links to Docs + Product CTA pages.

**Step 3: Weekly publishing cadence**
- 2 posts/week for first 8 weeks.

---

### Task 5: Community and social distribution workflow

**Files:**
- Create: `docs/plans/2026-03-03-x-community-distribution-runbook.md`
- Create: `site/docs/community/posting-policy.md`
- Create: `site/docs/community/post-templates.md`

**Step 1: Distribution channels**
- X.com thread, GitHub Discussions, Reddit/HN/IndieHackers (where policy-compliant).

**Step 2: Post templates**
- Build reusable templates: launch, update, case study, benchmark, tutorial.

**Step 3: Human-gated account ops**
- User provides account login/session; all outbound posting remains human-approved.

---

### Task 6: Monetization pathway and measurement loop

**Files:**
- Create: `site/docs/monetization/plan.md`
- Create: `site/docs/monetization/pricing-intent.md`
- Create: `docs/plans/2026-03-03-growth-experiment-backlog.md`

**Step 1: Define revenue paths**
- Paid consulting leads, tool subscriptions, enterprise setup, sponsorship/affiliate (if applicable).

**Step 2: Instrument conversion events**
- CTA click events, waitlist submit, contact form submit.

**Step 3: Weekly growth review**
- Keep, kill, scale decisions based on traffic-quality + conversion.

---

### Task 7: Verification and launch checklist

**Files:**
- Create: `docs/plans/2026-03-03-pages-launch-checklist.md`

**Step 1: Verify build and deploy**
- Run docs build locally and confirm GitHub Pages deployment is green.

**Step 2: Verify SEO readiness**
- Page indexing checks, sitemap submission, no broken links.

**Step 3: Verify funnel behavior**
- Validate all CTAs route correctly to `cli.rexai.top`, `rexai.top`, `tool.rexai.top`.
