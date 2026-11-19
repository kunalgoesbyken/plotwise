# Pivot playbooks: if the brief is not "plot → designs"

Every playbook keeps the same backbone, so the tech plan's discipline carries over:

- Hour 0–2: live URL.
- A deterministic core with tests.
- AI only where it is strong.
- A small eval with saved runs.
- DECISIONS.md.
- The same repo setup, deploy and submit steps (04-tech-plan.md Task 0 and Task 10).

---

## A. Generic playbook (any unfamiliar domain)

1. **Hour 0–1, read the brief three times.**
   - List every noun (inputs, outputs, users) and every number in it.
   - Write BRIEF.md and a one-paragraph "what done looks like".
2. **Hour 1–2, find the hard core.**
   - Which part is a real computation or judgment, and which part is UI?
   - The judged thing is almost always the hard core done honestly, plus a clear write-up of the calls made.
3. **Hour 1–3, research with a cap.**
   - One research subagent, at most 8 web calls (prompt P2), returning a 1-page domain primer with sources.
   - Save it to `research/primer.md`. Don't spend more than 3 hours on research.
4. **Hour 2–4, the thinnest end-to-end slice.** Input → core → output on screen → deployed.
5. **Hour 4–30, deepen the core.**
   - Tests for every rule.
   - Run edge cases from the domain primer as tests.
6. **Hour 22–30, measure.** Choose a small labelled set (20–100 items), two methods, numbers and a limits section.
7. **Hour 30–46.** Polish, write-up notes, transcripts, submit with a buffer.

**Signals they look for** (from their own pages):
- making calls and writing down why;
- numbers with ranges and sources;
- one link that works on a phone;
- no fake 3D or fake AI claims.

---

## B. "A checker that shows every rule a set of drawings breaks"

The same rule-pack engine, plus plan reading. Kush listed this as shipped, so it is the second most likely task.

**The product slice:**
- The user uploads a floor plan or site plan (PDF or image), sets the scale, and picks a rule set.
- They get:
  - a list of violations, each with its clause;
  - each violation highlighted on the plan and on a simple 3D extrusion;
  - "measured vs stated" contradictions, such as an area label that disagrees with the computed area.

**The tech:**

1. **Vector-PDF path first, using pdfjs-dist ^6.**
   - In the browser, read `page.getOperatorList()` and pull out path segments. Paths are packed in `constructPath`; see mlightcad/cad-viewer `pdfVectorImport.ts`.
   - Known bug: this returns empty in Node for v5.1+, so parse in the browser only.
2. **Text items** via `getTextContent()`: room labels and dimension strings ("3.6 x 4.2", "12'-0\"").
3. **Scale recovery:** pair dimension strings with nearby parallel segments, then take the median px-per-m with an outlier filter. Show the confidence.
4. **Rooms:** close the wall segments into polygons (snap tolerance + a planar graph of the faces), then label them with the text inside.
5. **Raster fallback:**
   - tesseract.js ^7 for labels;
   - the user clicks room corners (assisted tracing);
   - don't promise automatic raster room detection, since the research shows it is unreliable.
6. **Rules:**
   - room minimum areas and widths, ventilation and window area as a % of floor area, stair and corridor widths (MBBL 2016 has these: point at them with P4, compile, run check-pack, and resolve the questions with P5);
   - site-level FAR, coverage and setbacks reuse the main plan's engine.
7. **AI's role:**
   - a VLM or LLM as a verifier that flags labels it disagrees with;
   - an LLM explanation per violation.
   - Areas always come from the geometry.

**The eval:** ResPlan (CC BY 4.0, vector plans in metres) rendered to images and PDFs. Compare:
- room-area MAPE, geometry vs VLM-only;
- room-count accuracy;
- dimension-scale recovery error.

Baselines: VLMs had 43% area error; AECV-bench counting accuracy was 34–51%.

**The trap:** spending 20 hours on raster recognition. Do vector first; raster gets assisted tracing.

---

## C. Drawings → 3D model → quantities and cost (BOQ)

**The product slice:**
- The user uploads a plan, or traces it with assistance, and sets the floor count and heights.
- They get a 3D model with openings, a quantity schedule (wall m², slab m³, plaster, flooring, doors and windows), and a cost range per floor using CPWD 2025 rates (in sources).
- Contradictions are flagged: stated vs measured areas, and walls that don't meet.

**The tech:** B's plan reader → three.js extrusion → three-bvh-csg (0.0.18, experimental: keep the cuts simple) for door and window openings → a quantities module with unit tests per element.
- Export to CSV for the BOQ.
- glTF export is free with GLTFExporter.
- IFC (web-ifc) is a stretch goal; label it so.

**The eval:** quantities on 10 hand-measured ResPlan plans; report the % error per quantity type.

---

## D. Watching AI agents build a 3D model (a dashboard)

Kush ran "6 agents coordinating a climbing gym model, live… a QA agent pings me when it has to assume a height".

**The product slice:**
- A three.js scene that updates as agents emit typed actions (`addWall`, `setHeight`, `assume`).
- A timeline/log per agent, and an "assumptions inbox" where the QA agent flags guesses for a human to confirm.
- Replay and scrub through the build.

**The tech:**
- Define an action schema (zod) and a deterministic reducer from actions to scene state (unit-tested).
- Generate recordings offline: run the agents as Claude Code subagents in-session, writing JSONL action logs (no API).
- The app replays the logs, with optional live mode over SSE from a Vercel function only if the brief demands it.

**The eval:** how many assumptions the QA agent flagged vs how many were planted in the input spec (recall/precision).

---

## E. FloorSense: footfall from CCTV in the browser

**The product slice:**
- The user uploads a clip and draws count lines or zones.
- They get in/out counts, an occupancy curve, a dwell heatmap, a CSV, and an error estimate against a hand count.
- No face recognition: say so, and match their site.

**The tech:**
- onnxruntime-web ^1.31 (WebGPU with a WASM fallback) running YOLOX-nano or RT-DETR (Apache-2.0; avoid Ultralytics AGPL).
- Port a simple IoU/ByteTrack tracker (~150 lines of TS).
- Line-crossing counting, ported from the Ultralytics counting docs.
- Process offline at 3–5 fps with a progress bar.

**The eval:** hand-count 3 short public clips (MOT17 or a CC-licensed mall video). Report the count error and ID switches.

**The trap:** claiming real-time on a CPU. Say "offline processing, N fps on a mid laptop".

---

## F. Construction progress from site photos

**The product slice:**
- A schedule of floors and milestones.
- The user uploads dated photos and tags each to a floor and zone (assisted).
- They get a progress timeline, planned vs actual per floor, and contractor bills vs measured progress.
- Unsafe-condition flags come from a VLM, with confidence, as suggestions only.

**Honesty:** no automatic photo-to-BIM alignment; it needs SfM and a GPU. Say so in the limits.

**The eval:** label 30 public construction photos for stage (excavation, columns, slab, brickwork, finishing). Compare VLM accuracy with a simple rule baseline.

---

## G. Something agentic-commerce (General Machines side, less likely)

The product slice: a CartTrace-style viewer or eval. Load episodes from HF `generalmachines/CartTrace-100k`, show where shopping agents fail, and build a small failure classifier.

The tech:
- DuckDB-WASM or a preprocessed JSON sample;
- a classifier that is rules plus an LLM labeller;
- an eval against held-out labels.

Read their paper first (generalmachines.ai/papers/carttrace-100k.pdf).

---

## Pivot decision table (Task 0)

| The brief mentions | Use |
|---|---|
| plot, land, FAR/FSI, massing, feasibility | 04-tech-plan.md (main) |
| drawings, plans, sanction, compliance, violations | B, plus Tasks 1–2 of the main plan |
| quantities, BOQ, cost, IFC, 3D from drawings | C |
| agents, live, dashboard, coordination | D |
| CCTV, footfall, cameras, visitors | E |
| site photos, progress, schedule, bills | F |
| shopping agent, checkout, dataset, eval | G |
| anything else | A |
