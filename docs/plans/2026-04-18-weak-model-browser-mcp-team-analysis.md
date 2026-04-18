# Weak-Model Browser MCP Multi-Agent Analysis

## Goal
Use parallel AIOS workers to analyze why weaker models (for example `GLM-5`, `minmax-m2.5`, `minmax-m2.7`, some Ollama-local models) underperform on browser MCP tasks that stronger models (`codex`, `Claude + Claude`) can complete.

## Route
- Execution mode: `team`
- Workers: 3
- Provider: `codex`
- Style: root-cause analysis only; no code changes in this run

## Investigation Domains
1. **Model capability domain**
   - Focus on planning depth, tool-call reliability, long-horizon state tracking, JSON/schema obedience, and ambiguity recovery.
2. **MCP contract/tooling domain**
   - Focus on whether the current browser MCP surface is too low-level, too noisy, or too strict for weaker models.
3. **Client prompt/integration domain**
   - Focus on whether AIOS/native/Claude-client prompt layers give enough browser workflow guidance for weaker models.

## Evidence Anchors
- `scripts/run-browser-use-mcp.sh`
- `.mcp.json`
- `client-sources/native-base/shared/partials/browser-mcp.md`
- `mcp-server/src/browser/index.ts`
- `docs/plans/2026-03-08-browser-ax-snapshot-design.md`
- External runtime: `/Users/molei/codes/ai-browser-book/mcp-browser-use`

## Required Outputs
- Each worker must return:
  - top 3 root causes in its domain,
  - confidence level,
  - evidence-backed reasoning,
  - concrete recommendations ranked by impact.
- Merge output must answer:
  - Is the primary issue model ability, MCP clarity, or both?
  - Which fixes help weak models most without hurting strong models?

## Constraints
- No speculative blame without repo/runtime evidence.
- No code changes during the discussion run.
- Recommendations should distinguish:
  - quick prompt/tool-contract improvements,
  - medium-term MCP ergonomics work,
  - limits that must be accepted as model-class constraints.

## Stop Conditions
- All three domains return usable findings.
- Merge produces one ranked conclusion and one practical improvement roadmap.

## Discussion Execution Log (2026-04-18)
- Attempt 1: `node scripts/aios.mjs team 3:codex ... --live --force --format json`
  - planner phase blocked by provider rate-limit (`429 Too Many Requests`), chain blocked.
- Attempt 2: `node scripts/aios.mjs team 3:claude ... --live --force --format json`
  - planner + implementer completed, review/security auto-completed (no file mutations in upstream handoff), merge-gate passed.

## Merged Root-Cause Conclusion
Weak-model browser failures are **stacked effects**, not a single bug:

1. **Model capability boundary (≈30%)**
   - Weaker models lose stability on multi-step browser loops (read -> decide -> act -> verify).
   - They are more brittle with strict schema/locator constraints and ambiguity recovery.

2. **MCP contract ergonomics (≈40%)**
   - Existing tooling is locator-heavy and strict-unique by default; weaker models fail earlier on ambiguity.
   - Raw page text/HTML is high entropy for weak planners; action extraction is insufficiently guided.

3. **Client prompt/process guidance (≈30%)**
   - Without enforced operating loops, weaker models chain blind actions.
   - Lack of concise “next-action primitives” amplifies failure cascades.

## Implemented Improvements (already delivered)
1. **Prompt/SOP hardening in AIOS native layer**
   - Updated `client-sources/native-base/shared/partials/browser-mcp.md` with explicit:
     - `read -> act -> verify` loop,
     - `page.semantic_snapshot` first on dense pages,
     - `page.click_text` preference for visible labels,
     - strict single-step execution policy.

2. **Runtime primitive upgrades in browser-use MCP**
   - Added `page.click_text` (text-first click with optional `exact`, `nth`, `timeout_ms`).
   - Added `page.semantic_snapshot` (compact headings/actions summary for weaker planners).
   - Added validation models/tests and README tool docs.

## Verification Evidence
- AIOS native tests:
  - `node --test scripts/tests/native-sync.test.mjs scripts/tests/native-doctor.test.mjs`
  - Result: 13 passed.
- browser-use MCP tests:
  - `./.venv/bin/pytest tests/test_server_phase2_tools.py tests/test_types.py -q`
  - Result: 12 passed.
  - `./.venv/bin/pytest -q`
  - Result: 12 passed.

## Manual Smoke Test (Real CDP)
- Date: 2026-04-18
- Target flow:
  - `browser.connect_cdp` -> `page.goto("https://example.com")`
  - `page.semantic_snapshot`
  - `page.click_text("More information")`
  - `browser.close`
- Execution result (real runtime, not mocked):
  - `connect`: success
  - `goto`: success but `final_url` returned empty string
  - `semantic_snapshot`: failed (`error.code=UNKNOWN`)
    - error excerpt: `SyntaxError: Unexpected end of input`
  - `click_text`: failed (`error.code=UNKNOWN`)
    - error excerpt: `ReferenceError` during JS evaluation in locator resolution path
  - `close`: success
- Assessment:
  - Unit tests are green, but real browser smoke exposes runtime JS-eval incompatibility/bug paths.
  - Current status should be treated as **feature shipped but not production-ready for weak-model uplift** until smoke blockers are fixed.

## Immediate Fix Targets From Smoke
1. `page.semantic_snapshot` injected JS body in `mcp-browser-use/src/mcp_browser_use/server.py` (syntax/runtime compatibility with browser-use `page.evaluate`)
2. `page.click_text` locator JS path in `mcp-browser-use/src/mcp_browser_use/locator.py` (argument passing / evaluate contract mismatch)
3. `page.goto` post-navigation URL readback (`final_url` empty) in `mcp-browser-use/src/mcp_browser_use/server.py`

## Remediation Applied (2026-04-18, follow-up)
- `mcp-browser-use/src/mcp_browser_use/server.py`
  - fixed semantic snapshot evaluate payload handling for browser-use stringified object returns.
  - removed script-tail marker pattern causing runtime evaluate fragility.
  - added URL readback fallback (`page.get_url` -> `location.href`) for `page.goto` and shared URL checks.
- `mcp-browser-use/src/mcp_browser_use/locator.py`
  - replaced `arguments[0]` pattern with explicit function argument (`(input) => {...}`) for evaluate compatibility.
  - improved text-click candidate selection: prefer interactive elements + selector dedupe to reduce false `NOT_UNIQUE`.
- Tests
  - extended phase2 server tests with URL fallback + semantic JSON-string payload + locator-script guard.
  - local suite now green: `pytest -q` => 15 passed.

## Manual Smoke Re-Test (Real CDP, after remediation)
- Date: 2026-04-18
- Flow:
  - `browser.connect_cdp`
  - `page.goto("https://example.com")`
  - `page.wait(text="Example Domain")`
  - `page.semantic_snapshot(max_items=8)`
  - `page.click_text("Learn more")`
  - `browser.close`
- Result: all calls succeeded in real runtime.
- Key evidence:
  - `page.goto.final_url = https://example.com/`
  - `semantic_snapshot.title = "Example Domain"`, `total_actions = 1`
  - `click_text.ok = true`, `resolved.css_selector = "a"`

## Priority Roadmap (next)
1. **P0 (immediate):**
   - Roll out new tools + SOP to target clients.
   - Add task-level telemetry for weak-model success/failure by step (read/act/verify).
2. **P1 (short-term):**
   - Improve `NOT_UNIQUE`/`NOT_FOUND` error hints with top candidate disambiguation cues.
   - Add model-tier prompt presets (weak/medium/strong) with different action budgets.
3. **P2 (mid-term):**
   - Introduce compact-vs-full snapshot auto-mode by model tier.
   - Build a weak-model browser benchmark set for regression gates.
