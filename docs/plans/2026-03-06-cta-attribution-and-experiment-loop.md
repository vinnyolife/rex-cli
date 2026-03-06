# CTA Attribution and Experiment Loop (Internal)

## Goal

Track and improve docs-to-GitHub conversion with a repeatable CTA experiment loop.

## Boundary

- Public developer pages: `docs-site/**` (only product-facing CTA copy and links)
- Internal experiment tracking: `tasks/**` and `docs/plans/**`

## UTM Convention

Base:

- `utm_source=cli_rexai_top`
- `utm_medium=docs`
- `utm_campaign=english_growth`
- `utm_content=<page_slot_variant>`

Examples:

- `home_hero_star`
- `comparison_hero_star`
- `case_handoff_footer_star`

## CTA Tracking Attributes

Every tracked CTA should include:

- `data-rex-track="cta_click"`
- `data-rex-location="<page_slot>"`
- `data-rex-target="<intent_target>"`

## Daily Experiment Loop

1. Choose one page and one slot to test.
2. Run one variant for at least one full day.
3. Log views/clicks/stars before and after.
4. Keep/kill decision:
   - Keep if click-through or downstream stars improve.
   - Kill after 2 flat/negative days.

## First Round Targets

1. Home hero star button
2. Comparison hero star button
3. Three case-page footer star buttons
