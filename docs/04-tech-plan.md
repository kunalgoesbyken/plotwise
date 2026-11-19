# Plotwise Implementation Plan (tech plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (chosen default: native) or superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** A browser tool where you draw a plot, mark its roads, describe the project in plain English, and get 3 bye-law-compliant designs in 3D. Each design has an area statement, parking and a cost range, plus a rule table where every limit cites its clause, page and verbatim quote.

**Architecture:**

| Layer | Contents |
|---|---|
| Engine | Pure TypeScript with no DOM: rule packs (JSON, zod-validated) → plot geometry (clipper2-ts) → envelope search → typologies → options. Fully unit-tested. |
| View | Vanilla TS: SVG plot editor, HTML report, three.js scene (lazy chunk). |
| API | One Vercel function: plain-English brief → typed program, through a free OpenRouter model. Always optional. |
| Tools | Rule compiler (AI pointers → checked packs), invariant checker, eval scorer, run with tsx. |

**Tech stack** (versions checked on npm on 2026-11-19; pin the majors):

| Package | Version | License |
|---|---|---|
| vite | ^8 | MIT |
| typescript | ^5 | |
| three | ^0.187 | MIT |
| clipper2-ts | ^2.0.1 | BSL-1.0 (fine for a public repo) |
| suncalc | ^2.1.4 | |
| zod | ^4 | MIT |
| vitest | ^5 | MIT |
| fast-check | ^4 | MIT |
| tsx | ^4 | MIT |
| @vercel/node | ^32 | Apache-2.0 |

**Not used:** the npm package `str8`. It is a string library, not a straight-skeleton library, despite what the research agent said.

**Spec:** 03-product-plan.md (product) and 02-what-to-build.md (rule numbers and calls). Sources are in `sources\`.

## Global Constraints

- **Nothing starts before the clock.** Build only in a fresh Claude Code session after `start_assignment`, with the MCP added (06-prompt-guide.md §1).
- **Task 0 gates everything.** If the brief is not plot → designs, open 05-pivot-playbooks.md instead.
- **Free only.** No paid APIs. No Claude API from the app, scripts or eval. The LLM is an OpenRouter `:free` model, with `OPENROUTER_API_KEY` held only in a Vercel env var.
- **Coding standards.** No code comments. KISS/YAGNI/DRY. No rule number outside `src/rules/packs/*.json`, and no assumption outside `src/solve/assumptions.ts`.
- **Units.** SI internally (m, sqm, ₹). Feet and sqft are converted only in `src/view/units.ts`.
- **Geometry.** Local planar metres, origin at the first vertex. Lat/lng is used only for sun position (default Bengaluru 12.97, 77.59).
- **Clipper precision.** Scale by 1000 (mm integers) if the integer API is used. Check the `PathD`/`PathsD` double API availability at Task 3 and log the choice as D7.
- **Performance.**
  - Main JS under 120 KB gzipped; three.js chunk loaded lazily.
  - `options()` under 50 ms for an 8-vertex plot (vitest bench).
  - First view under 3 s on Fast 4G emulation.
- **Commits.** Author `Kunal Roy Choudhury <71250874+kunalgoesbyken@users.noreply.github.com>`, no Claude co-author line. Repo `github.com/kunalgoesbyken/plotwise` (public), plus a "Protect main" ruleset with admin bypass.
- **Write-up.** WRITEUP.md is Kunal's own words; I only supply notes.

## Repo layout

```
plotwise/
  BRIEF.md                 full brief, saved at hour 0
  DECISIONS.md             D1… every call made, one line why
  CLAUDE.md                project rules for agents (template in 06-prompt-guide.md)
  README.md                what, run, test, deploy, architecture diagram
  WRITEUP.md               Kunal's write-up, also rendered at /writeup
  index.html
  vite.config.ts           manualChunks: three → 'three'
  vercel.json              { "rewrites": [{ "source": "/writeup", "destination": "/index.html" }] }
  api/brief.ts             Vercel function
  src/
    main.ts                boot: decode URL → state → mount
    rules/types.ts         Cite, Band, RulePack
    rules/load.ts          loadPack, PACK_IDS (zod)
    rules/lookup.ts        lookup()
    rules/packs/mbbl-2016.json
    rules/packs/bda-rmp2015.json
    rules/packs/bda-rmp2015-2026amend.json
    rules/packs/kmc-2009.json
    geom/polygon.ts        area, normalize, selfIntersects, inside, setbackEnvelope, edgeDepthWidth
    solve/envelope.ts      envelopes()
    solve/typologies.ts    footprint()
    solve/parking.ts       parking()
    solve/cost.ts          cost()
    solve/assumptions.ts   ASSUMPTIONS (each value carries a source)
    solve/options.ts       options()
    brief/schema.ts        ProgramSchema
    brief/parse.ts         parseBrief()
    state/url.ts           encode/decode
    view/units.ts          m↔ft, sqm↔sqft
    view/plotEditor.ts     mountEditor
    view/report.ts         renderReport, rule sheet
    view/scene.ts          mountScene (lazy)
    view/app.ts            layout, tabs on mobile
    view/writeup.ts        renders WRITEUP.md
    styles.css
    rules/edges.ts         parseEdge(): "Up to 12.0" / "Above 12.0 up to 18.0" / "Above 30.m" → {min,max,inclusiveMax}
  sources/<id>.txt         copied from the prep folder's sources/ (pdftotext -layout output)
  tools/pages.ts           splitPages(): .txt → page → line[] (1-based line numbers)
  tools/compile-pack.ts    pointers/<id>.json → src/rules/packs/<id>.json; exits 1 if any pointer fails
  tools/check-pack.ts      invariants over a compiled pack; exits 1 on a violation
  pointers/<id>.json       AI output: pointers to source lines + interpretation questions (never numbers)
  eval/ground-truth/*.json hand-typed values, checked against the PDF page
  eval/runs/<method>-<pack>.json
  eval/known-ambiguities.json  questions a careful reader must raise, written by Kunal before the AI runs
  eval/score.ts            prints and writes eval/RESULTS.md
  transcripts/             exported session .jsonl (if the brief wants them in the repo)
```

## Core algorithms (the only parts the signatures don't determine)

### Rule reading: "AI points, code copies, invariants check, a human decides"

This replaces the old "one AI extracts, a second AI verifies" design. A second AI checking the first has the same blind spots, costs twice as much, and proves nothing. Here the AI can't put a wrong number into a pack, because it never writes a number.

Why this works for these sources:
- The tables have a clean text layer (`pdftotext -layout`). There is no OCR and no table-recognition model.
- There are only ~10 tables across the three rulebooks.
- Transcription is easy. **Interpretation is hard.** Example: BDA Table 10 puts plot size, coverage, FAR and road width in one row. Is FAR set by the plot-size column, the road-width column, or the lower of the two? Note (b) also caps height at 11.5 m on roads under 9 m "irrespective of FAR". The source also has typos ("Above 30.m").

The pipeline:
1. **`splitPages`** turns `sources/<id>.txt` into pages of numbered lines. Pages are split on form-feed `\f`; check this and log it as a decision.
2. **AI (one pass, prompt P4)** writes `pointers/<id>.json`. Each band is `{ field, valueRef, edgeRef }`, where a ref is `{ page, line, token }` and `token` is the exact text on that line ("1.75", "Above 12.0 up to 18.0"). The AI also writes `questions[]`: every interpretation question it sees, with both readings and the refs that cause it. It outputs no numbers of its own.
3. **`compilePack`** (code) resolves every ref:
   - the token must appear on that exact line, or the build fails with the ref;
   - the value is parsed from the source token, not taken from the AI;
   - edges go through `parseEdge`;
   - `cite.quote` is the full source line (plus the table title line), filled in automatically.

   Hallucinated numbers are impossible by construction. A wrong pointer is still possible, and step 4 and the human catch it.
4. **`checkPack`** (code) runs these invariants:
   - bands are sorted, start at 0, and have no gaps or overlaps (a gap means a missed row);
   - the declared direction holds: FAR is non-decreasing with road width or plot area, coverage is non-increasing with plot area, setbacks are non-decreasing with height;
   - values are in plausible ranges: FAR 0.5–5, coverage 0.3–0.9, setbacks 0–20 m, height factor 1–2;
   - each value is compared with MBBL 2016 (a difference is info, not an error).
5. **Kunal decides.** Each `questions[]` item becomes a DECISIONS.md entry, D-rule-N, chosen by Kunal with a reason. The pack stores the choice (for example `far.combine` for the BDA Table 10 axis question; the same FAR token can be pointed to twice, once with the plot-size edge and once with the road-width edge). The app shows it under "Interpretation" next to the rule, and offers a toggle where both readings are defensible.
6. **Golden tests:** 12–15 plots hand-computed from the PDF (for example a 30×40 ft plot on a 9 m road → FAR 1.75, coverage 75%). These are the acceptance tests and are written before compiling.

Honest note for the write-up: for 3 rulebooks, hand-typing ~60 numbers would be about as fast. The pipeline earns its keep on the next city (the live call: "add Dubai"), and it is the only way to show every number is traceable.

### Per-edge setback envelope (`setbackEnvelope`)

The buildable area is the plot minus the union, over all edges, of each edge buffered by its own setback:

```
buildable = difference(plot, union_i( inflatePaths([edge_i], d_i, JoinType.Round, EndType.Round) ))
```

- This works on non-convex and corner plots.
- Round ends make the corner distance conservative: the distance to the boundary is at least d in every direction.
- Log this as decision D8. Half-plane intersection is wrong for non-convex plots.

### Envelope search (`envelopes`)

For floors n = 1..maxFloors:

1. Compute the height: h = n·floorToFloor + stiltHeight.
2. Compute the setbacks per edge:
   - if `h ≤ lowRise.maxHeight`, use the % rules: road edges are fronts (% of depth), the edge opposite the main road is the rear, the rest are sides (% of width);
   - otherwise use `lookup(setbackByHeight, h)` on all edges.
3. Compute the height cap from the widest road:
   - `roadPlusFront`: factor × (road + that edge's setback);
   - `byRoad`: a band lookup.
4. Emit an envelope if h ≤ cap and the envelope is not empty; otherwise stop.

This is a brute-force search over floor counts, not a fixed-point iteration: simpler and exact. Log it as D6.

### Option search (`options`)

For each typology and each envelope:
1. Get the footprint, clipped to the envelope and capped at coverageMax × plot area.
2. Compute GFA = min(FAR × plot, footprint × floors).
3. Parking: ECS = GFA/100 × ecsPer100Sqm. Fill the stilt first, then basements, each of capacity ⌊envelope basement area / sqmPerEcs⌋.
4. Reject the option if basements exceed `maxBasements`.
5. Score by `priority`:
   - `far`: GFA;
   - `cost`: GFA / cost.mid;
   - `open`: GFA × (1 − coverage).

Return the best option per typology, then the top 3 by score with distinct typologies.

### Typologies (inside the envelope's minimum-area oriented bounding box, then clipped)

| Typology | Shape |
|---|---|
| slab | A full-length bar, depth ≤ 18 m (light and ventilation, assumption A4) |
| lblock | Two bars along the two longest perpendicular envelope edges |
| twin | Two slabs with a gap of at least the setback for the height (towers face each other) |
| podiumTower | A podium of ≤ 2 floors at max coverage, plus a tower ≤ 40% of the podium |

## Review Focus

1. **Plot so small or thin that the envelope vanishes:** the message names the setback that kills it. Task 3 test `vanishing strip`.
2. **Area or road width exactly on a band edge:** respect `inclusiveMax`, and show the band picked. Task 1 `lookup` tests (12 vs 12.01) and Task 2 golden test at exactly 360 sqm.
3. **Self-intersecting or clockwise polygon:** normalize to CCW; reject self-intersection with a message. Task 3 tests `bow-tie`, `cw input`.
4. **Corner plot with roads of 9 and 18 m:** the height cap uses 18, and both road edges are fronts. Task 4 test `corner`.
5. **LLM down, slow or returning junk:** fall back to the form, prefilled with whatever validated. Task 8 tests `timeout`, `non-json`, `negative unitSqm`.

---

### Task 0: Brief → decide → scaffold → live URL (hour 0–2)

**Files:** `BRIEF.md`, `DECISIONS.md`, `CLAUDE.md`, `README.md`, scaffold, `vercel.json`, `vite.config.ts`.

- [ ] In the fresh session: `get_assignment`, then show the warning word for word, wait for Kunal's yes, then `start_assignment`. Save the full brief to BRIEF.md.
- [ ] Compare the brief with this plan. If it is a match, write D1–D5 (from 02 "Calls to make"). If not, switch to 05-pivot-playbooks.md.
- [ ] Scaffold with `npm create vite@latest . -- --template vanilla-ts` inside `C:\Users\kuntr\Desktop\plotwise` (the session starts there), then `npm i three clipper2-ts suncalc zod` and `npm i -D vitest fast-check tsx @types/three @types/suncalc @vercel/node`.
- [ ] Create the repo and push: `gh repo create kunalgoesbyken/plotwise --public --source . --push`. Then link Vercel with `vercel link && vercel --prod`. **Expected:** a live URL returns 200.
- [ ] Commit `chore: scaffold`.

### Task 1: Rule pack schema + rule-reading tools (all deterministic, no AI)

**Files:** create `src/rules/types.ts`, `src/rules/load.ts`, `src/rules/edges.ts`, `src/rules/lookup.ts`, `tools/pages.ts`, `tools/compile-pack.ts`, `tools/check-pack.ts`; copy the prep folder's `sources/*.txt` into `sources/`. Tests: `load.test.ts`, `edges.test.ts`, `lookup.test.ts`, `compile-pack.test.ts`, `check-pack.test.ts`.

**Produces:**
- `type Cite = { source: string; clause: string; page: number; line: number; quote: string }`
- `type Ref = { page: number; line: number; token: string }`
- `type Pointers = { packId: string; source: string; bands: { field: 'farByPlotArea' | 'farByRoadWidth' | 'coverage' | 'setbackByHeight' | 'heightByRoad'; clause: string; valueRef: Ref; edgeRef: Ref }[]; scalars: { field: string; clause: string; valueRef: Ref }[]; questions: { id: string; question: string; readings: string[]; refs: Ref[] }[] }`
- `parseEdge(text: string): { min: number; max: number; inclusiveMax: boolean }` ("Up to X" → [0, X] inclusive; "Above X up to Y" → (X, Y] inclusive; "Above X" → (X, ∞); also tolerates "30.m", "m", "sq.m", "%")
- `splitPages(txt: string): Map<number, string[]>`
- `compilePack(p: Pointers, pages: Map<number, string[]>, decisions: Record<string, string>): { pack: RulePack } | { errors: { ref: Ref; reason: 'line_missing' | 'token_not_on_line' | 'unparseable' }[] }`
- `checkPack(pack: RulePack, baseline?: RulePack): { errors: string[]; info: string[] }`
- `lookup(bands: Band[], x: number): { value: number; band: Band } | null`
- `farLimit(pack: RulePack, plotArea: number, roadWidth: number): { value: number; cites: Cite[] } | null` (applies `far.combine`; `min` takes the lower of both readings)
- `type Band = { min: number; max: number; inclusiveMax: boolean; value: number; cite: Cite }`
- `type RulePack = { id: string; version: string; city: string; far: { byPlotArea?: Band[]; byRoadWidth?: Band[]; combine: 'plotArea' | 'roadWidth' | 'min'; decision?: string }; coverage: Band[]; setbackByHeight: Band[]; lowRise?: { maxHeight: number; frontPctDepth: number; rearPctDepth: number; sidePctWidth: number; cite: Cite }; heightCap: { kind: 'roadPlusFront'; factor: number; cite: Cite } | { kind: 'byRoad'; bands: Band[] }; parking: { ecsPer100Sqm: number; sqmPerEcs: number; cite: Cite }; floorToFloor: number; stiltHeight: number }`
- `loadPack(id: string): RulePack`
- `PACK_IDS: readonly string[]`

Steps:
- [ ] Write the failing tests:
  - `parseEdge("Up to 12.0")` → {0, 12, true}; `"Above 12.0 up to 18.0"` → {12, 18, true}; `"Above 30.m"` → {30, Infinity, false}; `"banana"` throws;
  - `lookup`: at 12 → first band, at 12.01 → second band, above the last bounded band → null;
  - `farLimit` with combine `min`, byPlotArea 2.25 and byRoadWidth 1.75 → 1.75 with both cites; with combine `roadWidth` → 1.75 with one cite;
  - `compilePack` with a hand-written 2-band pointer file over a 3-line fake page → the values come from the page text; a ref whose token is not on its line → `token_not_on_line`; a ref to line 999 → `line_missing`;
  - `compilePack` fills `cite.quote` with the source line verbatim;
  - `checkPack`: a gap between bands → error; FAR decreasing with road width → error; FAR 15 → error; a difference from the baseline → info only;
  - `load`: every quote in every shipped pack is found on its cited page and line (runs over `src/rules/packs/*.json`, so it passes vacuously until Task 2).
- [ ] Run `npx vitest run src/rules tools`. **Expected:** FAIL.
- [ ] Implement. Add CLIs: `npx tsx tools/pages.ts <id> <page>` (prints the page with line numbers, for the P4 agent), `npx tsx tools/compile-pack.ts <id>` and `npx tsx tools/check-pack.ts <id>` (both exit 1 on errors).
- [ ] Run the tests. **Expected:** PASS. Commit `feat: rule pack schema and compiler`.

### Task 2: The 4 rule packs (MBBL 2016, BDA 2007, BDA + Jan 2026 amendment, KMC 2009)

**Files:** `eval/ground-truth/<id>.json`, `eval/known-ambiguities.json`, `pointers/<id>.json`, `src/rules/packs/<id>.json`, `src/rules/golden.test.ts`, DECISIONS.md.

Order matters. The human truth comes before the AI runs, so the eval is fair.

- [ ] **Kunal, by hand (about 45 min):** open each table in the PDF. Write `eval/known-ambiguities.json` (at least the BDA Table 10 FAR axis question, Note (b)'s 11.5 m cap, and "Above 30.m"). Hand-type `eval/ground-truth/<id>.json`, values only.
- [ ] Write `golden.test.ts`: 12–15 hand-computed plots across the packs. Include:
  - BDA: 30×40 ft (111.5 sqm), 9 m road → FAR 1.75, coverage 0.75;
  - MBBL: FAR at plotArea 400 → 1.65; setbackByHeight at 24 → 8; heightCap is roadPlusFront with factor 1.5.

  **Expected:** FAIL (packs missing).
- [ ] Run P4 once per pack, one subagent each, in parallel (they share no state). Each writes `pointers/<id>.json` and `eval/runs/point-<id>.json` (a raw copy).
- [ ] For each pack, run `compile-pack` and then `check-pack`. On a pointer error, re-run P4 for that table only, with the error pasted in. Never hand-edit a value.
- [ ] Bring every `questions[]` item to Kunal in one list. Kunal picks a reading. Log it as D-rule-N in DECISIONS.md and pass it to `compilePack` via `decisions`.
- [ ] Run `npx vitest run`. **Expected:** golden tests PASS and the load test finds every quote. Commit `feat: rule packs compiled from source pointers`.

### Task 3: Polygon core + setback envelope

**Files:** `src/geom/polygon.ts`. Test: `polygon.test.ts`.

**Produces:**
- `type Pt = { x: number; y: number }`
- `type Plot = { pts: Pt[]; roads: (number | null)[] }`
- `area`, `normalize`, `selfIntersects`, `inside(inner: Pt[][], outer: Pt[]): boolean`
- `setbackEnvelope(p: Pt[], d: number[]): Pt[][]`
- `edgeDepthWidth(plot: Plot): { depth: number; width: number }`

Steps:
- [ ] Write the failing tests:
  - a 20×30 rectangle with d=[3,1.5,1.5,1.5] → area 433.5 ± 0.5. The round joins cut the corners slightly; assert against the clipper result and note the delta;
  - an L-shaped plot with d=2 stays inside;
  - `vanishing strip`: 5×40 with d=3 → `[]`;
  - `bow-tie` → selfIntersects is true;
  - `cw input` → normalize returns CCW;
  - fast-check property over random convex 3–8-gons with d in 0–5: area(env) ≤ area(plot) and inside.
- [ ] Run them and confirm they fail.
- [ ] Implement with clipper2-ts `inflatePaths` on open edge paths, then `union`, then `difference`.
- [ ] Run the tests. **Expected:** PASS. Commit.

### Task 4: Envelope search

**Files:** `src/solve/envelope.ts`. Test: `envelope.test.ts`.

**Produces:**
- `type Check = { rule: string; limit: number; value: number; pass: boolean; cite: Cite }`
- `type Envelope = { floors: number; height: number; poly: Pt[][]; setbacks: number[]; heightCap: number; checks: Check[] }`
- `envelopes(plot: Plot, pack: RulePack, maxFloors: number): Envelope[]`

Steps:
- [ ] Write the failing tests:
  - MBBL, 30×40 m plot on a 12 m road: the last height ≤ 1.5 × (12 + front setback);
  - setbacks never decrease as floors increase;
  - `corner` (9 and 18 m roads) → the cap uses 18;
  - BDA with a 9 m road → height ≤ 11.5;
  - every check has a cite.
- [ ] Run them and confirm they fail.
- [ ] Implement the search from "Core algorithms".
- [ ] Run the tests. **Expected:** PASS. Commit.

### Task 5: Typologies, parking, cost, options

**Files:** `typologies.ts`, `parking.ts`, `cost.ts`, `assumptions.ts`, `options.ts`. Tests: `options.test.ts`, `cost.test.ts`, `options.bench.ts`.

**Produces:**
- `type Program = { use: 'residential' | 'commercial' | 'mixed'; unitSqm: number; maxBasements: number; priority: 'far' | 'cost' | 'open' }`
- `type Typology = 'slab' | 'lblock' | 'twin' | 'podiumTower'`
- `type Range = { lo: number; hi: number }`
- `footprint(t: Typology, env: Pt[][], maxSqm: number): Pt[][]`
- `parking(gfa: number, pack: RulePack, basementSqm: number): { ecs: number; basements: number; stilt: boolean }`
- `cost(i: { gfa: number; basementSqm: number; footprintSqm: number; floors: number }): { sub: Range; sup: Range; services: Range; total: Range }`
- `type Option = { id: 'A' | 'B' | 'C'; typology: Typology; floors: number; footprint: Pt[][]; areas: { plot: number; permissibleFar: number; proposedFar: number; coverage: number; builtUp: number; gfa: number; carpet: number; saleable: number }; units: number; parking: ReturnType<typeof parking>; cost: ReturnType<typeof cost>; checks: Check[] }`
- `options(plot: Plot, pack: RulePack, program: Program): Option[]`
- `ASSUMPTIONS`. Each entry is `{ value, source }`:
  - carpetOfGfa 0.75
  - loading 1.30
  - superRate 30920 ₹/sqm (CPWD PAR 2025, office/RCC ≤6 storeys)
  - basementRate 23170 ₹/sqm
  - raftRate 12765 ₹/sqm
  - servicesPct 0.25–0.30
  - cityFactor 0.9–1.1
  - sqmPerEcs 32
  - slabDepthMax 18

Steps:
- [ ] Write the failing tests:
  - proposedFar ≤ permissibleFar + 1e-6;
  - coverage ≤ max;
  - every footprint is inside its envelope;
  - ids A/B/C use distinct typologies;
  - raising maxBasements from 1 to 2 never lowers the best FAR;
  - cost lo < hi;
  - the bench runs under 50 ms.
- [ ] Run them and confirm they fail.
- [ ] Implement from "Core algorithms".
- [ ] Run the tests. **Expected:** PASS. Commit.

### Task 6: Editor + report + URL state + units (hour ~10, deploy)

**Files:** `plotEditor.ts`, `report.ts`, `app.ts`, `units.ts`, `url.ts`, `styles.css`. Tests: `url.test.ts`, `units.test.ts`.

**Produces:**
- `encode(s: { plot: Plot; program: Program; pack: string; units: 'm' | 'ft' }): string`
- `decode(h: string): typeof s | null`
- `mountEditor(el, plot, onChange)`
- `renderReport(el, opts, pack)`

Steps:
- [ ] Write the failing tests:
  - decode(encode(s)) deep-equals s;
  - decode('garbage') → null;
  - 30×40 ft → 111.48 sqm.
- [ ] Run them and confirm they fail.
- [ ] Implement:
  - screens per 03-product-plan.md §4;
  - presets: 30×40 ft, 60×90 ft corner, 1-acre trapezoid;
  - the error messages from §4;
  - the rule sheet with the quote.
- [ ] Run the tests. Then manual check in the dev server at 390 px: the presets render 3 options with no console errors. Deploy and commit.

### Task 7: 3D scene (hour ~16, deploy)

**Files:** `src/view/scene.ts`.

**Produces:** `mountScene(el): { show(plot, opts, active, envelope): void; setSun(date: Date, hour: number, lat: number, lng: number): void; dispose(): void }`

The scene shows:
- the ground plot;
- a dashed setback outline;
- a translucent height-cap volume;
- per-floor slabs with 0.15 m gaps;
- basements below grade.

Renderer settings: AgX tone mapping, PCFSoft shadows, OrbitControls, a suncalc-driven directional light, DPR capped at 2.

- [ ] Run `npm run build`. **Expected:** main < 120 KB gzipped, with a separate `three` chunk.
- [ ] Manual check on the 1-acre preset: ≥30 fps while orbiting in Moto G4 emulation, and the sun slider moves the shadows. Deploy and commit.

### Task 8: Brief parser + API (hour ~20)

**Files:** `api/brief.ts`, `src/brief/schema.ts`, `src/brief/parse.ts`. Test: `parse.test.ts`.

**Produces:** `parseBrief(text: string, fetcher?: typeof fetch): Promise<{ program: Partial<Program>; source: 'llm' | 'fallback'; issues: string[] }>`

Steps:
- [ ] Write the failing tests with a mocked fetch:
  - valid JSON → `llm`;
  - `negative unitSqm` → that field is dropped and an issue is recorded;
  - `timeout` (8 s, via AbortController) → `fallback`;
  - `non-json` → `fallback`.
- [ ] Run them and confirm they fail.
- [ ] Implement:
  - The API uses system prompt P6 from 06-prompt-guide.md with `response_format` JSON.
  - The model comes from env `BRIEF_MODEL` (an OpenRouter `:free` model, chosen at build time from the free list).
  - Rate limit: 20 requests per IP per hour, in memory.
- [ ] Run the tests. Then manual check on prod with "G+12 residential, mostly 2BHK, max 2 basements": the form prefills. Commit.

### Task 9: Rule-extraction eval (hour ~22–28)

**Files:** `eval/ground-truth/*.json`, `eval/runs/*.json`, `eval/score.ts`, `eval/README.md`, `eval/RESULTS.md`. Test: `score.test.ts`.

**Produces:** `score(pred: RulePack, truth: RulePack): { n: number; valueExact: number; edgeExact: number; hallucinated: number; missed: number }` and `scoreQuestions(found: string[], known: string[]): { recall: number; extra: number }` (matching by Kunal's labels in the run file, not by string match)

**Method:** the question is "does making the AI point instead of write actually matter?"
- Ground truth: `eval/ground-truth/*.json` and `eval/known-ambiguities.json` from Task 2. Both were written before any AI run.
- Runs, one subagent per pack, raw outputs saved:
  - (a) **write:** P4-write. The AI types values and a quote, the classic approach. Only `parseEdge` is applied.
  - (b) **point:** the Task 2 pointers through `compilePack`, before Kunal's decisions.
  - (c) **point + check:** (b), with `checkPack` errors counted as caught.
- Report per method: value exact %, edge exact %, hallucinated values, missed bands, errors caught by invariants, and ambiguity recall.
- Run (a) twice. If the two runs disagree, report it: run-to-run agreement is a cheap uncertainty signal and needs no second model.

Steps:
- [ ] Write the failing tests:
  - identical packs → valueExact 1;
  - one wrong value → (n−1)/n;
  - an extra band → hallucinated 1;
  - 2 of 3 known questions found → recall 0.67.
- [ ] Run them and confirm they fail.
- [ ] Implement the scorer. Run a (twice), b and c in-session; the transcripts are the evidence.
- [ ] Run `npx tsx eval/score.ts`. **Expected:** RESULTS.md with a table and a limits section. Commit.

### Task 10: Fuzz, polish, write-up support, submit (hour 30–46)

- [ ] Write a fast-check fuzz test over 3–8-gons from 50 to 20,000 sqm, random roads and every pack. Assert that `options()` never throws, contains no NaN, and every check is either pass or flagged.
- [ ] Run `npx vitest run` and `npm run build`. **Expected:** all green.
- [ ] Do the should-haves from the product plan if time allows: CSV export, compare highlight, rule JSON panel.
- [ ] Hand Kunal his notes: DECISIONS.md, RESULTS.md, a D2 architecture diagram and the limits. He writes WRITEUP.md.
- [ ] Export transcripts (06 §6) and open every link in incognito.
- [ ] Run `time_left`. Then submit only after Kunal says so: `submit_application`, then `check_submission`.

## Time budget

| Hours | Work | Checkpoint |
|---|---|---|
| 0–2 | Task 0 | live URL |
| 2–6 | Tasks 1–2 | 4 packs compiled, check-pack clean, golden tests green |
| 6–10 | Tasks 3–4 | envelope tests green |
| 10–14 | Task 5 | options tests green |
| 14–18 | Task 6 | usable tool deployed |
| 18–22 | Tasks 7–8 | 3D + brief deployed |
| 22–28 | Task 9 | RESULTS.md |
| 28–30 | sleep or buffer | |
| 30–40 | Task 10 polish, should-haves | |
| 40–46 | write-up, transcripts, submit | 2 h buffer |

Sleep: plan two 5-hour blocks, around hours 14–19 and 32–37. Kunal sleeps; nothing runs unattended except long agent jobs with a clear stop condition.

## Risk register

| Risk | Sign | Fallback |
|---|---|---|
| clipper2-ts API differs from its README | Task 3 tests won't compile | Use the integer API ×1000, or polygon-clipping (MIT) for booleans plus a manual edge buffer |
| Garbled tables in the PDF text | compile-pack `token_not_on_line` or `unparseable` | Read the page image (pdf → png), fix the .txt line by hand in a separate `sources/patches/<id>.json` (page, line, old, new, reason), log it as a decision; never edit the pack directly |
| OpenRouter free model down or rate-limited | 429/5xx | The form fallback is already the default path; try a second free model |
| Low-spec PC chokes on the three.js dev server | dev lag | Test 3D on the deployed preview; keep one heavy job at a time |
| The brief differs | Task 0 | 05-pivot-playbooks.md |
