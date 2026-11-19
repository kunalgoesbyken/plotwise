# Product plan: Plotwise

Plot → three compliant building designs, where every number traces to a clause.

The research behind this is in 01-research.md and 02-what-to-build.md. The tech plan that implements it is in 04-tech-plan.md.

## 1. The problem, in their words

- Silicon Bricks blog (13 Nov): "Land is usually the largest single decision in a real estate project, and it is often made with the least information. A plot is offered, a rule-of-thumb multiplier is applied to its area, and a price is negotiated."
- Common mistakes, from the same post:
  - treating FAR as the answer;
  - ignoring exempted areas;
  - underestimating parking;
  - mixing up area terms;
  - using a single cost rate.
- Kush's shipped list (16 Nov): "pin a plot, describe it, get 3 building designs".
- Their /bim page promises "every bye-law checked, with its clause". Today it is static chips.
- Reddit (r/BangaloreRealEstates, r/indianrealestate, r/Indian_architects): buyers measure less carpet area than declared; Bangalore setback rules changed in Jan 2026 and Oct 2026; existing "FSI calculators" are forms with no geometry.

**One line:** "Before you pay for land, see what it can legally hold: three designs, every limit cited, in one link."

## 2. Who uses it

| User | Job to be done | What they need on screen |
|---|---|---|
| Developer / landowner (primary) | "Is this plot worth ₹X crore?" | Saleable area, unit count and cost range per option, side by side |
| Architect at concept stage | "Which massing should I develop?" | Setback envelope, height cap, typology trade-offs |
| Silicon Bricks sales/engineer (internal) | "Answer a lead's plot question on the first call" | Shareable link, presets, fast edit of rules |

Not for: sanction submission or legal advice. Say so on the page.

## 3. The core flow (under 60 seconds to first value)

1. **Open the link.** A preset plot is already loaded (a Bengaluru 60×90 ft corner site) with three designs showing. Value comes before any input.
2. **Change the plot:**
   - pick a preset (30×40 ft site, 60×90 ft site, corner plot, 1-acre trapezoid);
   - or drag the corners;
   - or type the dimensions.
3. **Mark the roads.** Tap an edge to make it a road and set its width (default 9 m). The rule set also picks the zone.
4. **Describe it (optional).** For example "G+12 residential, mostly 2BHK, max 2 basements, keep cost low". The AI fills the program form, and the user can edit any field.
5. **Read the three options A/B/C:**
   - a 3D massing;
   - an area statement;
   - unit yield, parking and a cost range;
   - a rule table.
6. **Tap any rule row.** It shows the exact clause text, the page and the source PDF.
7. **Share.** The URL carries the whole state, so it can be sent on WhatsApp.

## 4. Screens

### Main screen, desktop

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Plotwise   Rules: [Bengaluru RMP-2015 + Jan-2026 ▾]  Units: [m|ft]  Share │
├──────────────────────────┬────────────────────────────────────────────────┤
│ PLOT (SVG editor)        │ 3D VIEW  [A] [B] [C]   sun ──●──── 15 Mar 2pm  │
│  presets ▾               │   ground plot, setback outline, height-cap     │
│  edges: tap = road+width │   volume, floors as slabs, basements cut away  │
│                          │                                                │
│ BRIEF                    │                                                │
│  [describe your project] │                                                │
│  → use / unit size /     ├────────────────────────────────────────────────┤
│    basements / priority  │ OPTIONS          A Slab   B L-block  C Twin    │
│                          │ Floors           G+11     G+9        G+7       │
│ ASSUMPTIONS (editable)   │ FAR used/allowed 2.24/2.25 2.10/2.25 1.80/2.25 │
│  carpet 75% of GFA       │ Saleable (sqft)  …        …          …         │
│  loading 1.30            │ Units (2BHK)     …        …          …         │
│  cost factor BLR 1.0     │ Parking / bsmt   86 / 2   80 / 1     64 / 1    │
│                          │ Cost ₹ Cr        38–46    33–40      28–34     │
│                          │ RULES  ✓ FAR ≤2.25 (Tbl 10, p27)  ⚠ …          │
└──────────────────────────┴────────────────────────────────────────────────┘
```

### Mobile (390 px)

The same content stacked into tabs: **Plot**, **3D**, **Options**, **Rules**. The 3D view uses half the screen height. The options appear as swipeable cards.

### Rule detail sheet (opened by tapping a rule row)

- The rule name, the limit, this design's value, and pass/check.
- The verbatim quote, the source PDF name, the clause and the page.
- "Why this applies": the band picked and why (for example, "plot 557 sqm falls in >360–1000").

### Empty and error states

| State | Message |
|---|---|
| Nothing buildable | "A 6 m wide plot loses 5 m to setbacks at this height. Try fewer floors or a wider plot." |
| Bad polygon | "The edges cross. Drag a corner to fix it." |
| AI unavailable | "Couldn't read the brief. Fill the fields below." The tool still works. |
| Outside rule coverage | "These rules cover plots up to 20,000 sqm. Results beyond are not checked." |

## 5. What makes it impressive (and honest)

1. **Real geometry, not a calculator.** Per-edge setbacks on irregular and corner plots, and a height cap tied to road width plus the front setback.
2. **Every number is traceable.** Each limit links to its clause; each assumption is labelled and editable.
3. **The blog's own example, live.** "Option A reaches full FAR but needs a second basement; Option B doesn't." The tool shows this trade-off.
4. **AI where it is strong, code where AI is weak:**
   - AI reads the PDFs into rules, reads the brief and explains the trade-offs;
   - code measures every area and limit.
   - The write-up cites why: VLMs had 43% error on room areas, versus 5.7% for plain pixel counting.
5. **An eval, General Machines style.** Rule-extraction accuracy is measured across three methods, every number can be regenerated, and there is a limits section.
6. **Version-aware rules.** The Bengaluru 2007 text and the Jan 2026 amendment can be switched, which shows awareness that the rules are moving.
7. **Fast and shareable.** One link, works on a mid-range Android, three.js loads only when needed.

## 6. Scope

**Must have (by hour 30):**
- three rule packs: MBBL 2016, Bengaluru RMP-2015 with the Jan 2026 amendment, Kolkata KMC 2009;
- the plot editor, three options and the area statement;
- the rule table with clauses and the 3D view;
- shareable URL, the brief parser with its fallback, and the eval.

**Should have (by hour 40):**
- sun slider;
- sqft/ft units;
- CSV export of the area statement;
- compare mode that highlights the differences;
- an "edit rule pack" JSON panel, so a rule can be changed live on the call.

**Won't do:**
- sanction drawings or floor plans of flats;
- map parcels from Bhuvan;
- premium FAR/TDR (listed as next steps);
- user accounts.

## 7. Demo script (90 seconds, for the doc and the live call)

1. "This is a 60×90 ft corner plot on a 9 m and a 12 m road in Bengaluru." The link opens straight into it.
2. "Three designs. A uses the full FAR but needs two basements. B gives up 0.15 FAR and saves a basement, about ₹3 Cr." Tap the rule row: "here's Table 10, page 27, verbatim."
3. Drag a corner so the plot becomes irregular. The envelope and the options update live.
4. Type "commercial, max 1 basement". The AI fills the program and the designs change.
5. Switch the rules from 2007 RMP to the Jan 2026 amendment on a 30×40 site. The setbacks shrink, and the tool shows which clause changed.
6. "The AI never types a rule number. It points at the line in the PDF text, code copies the value, invariant checks catch gaps, and I decided every interpretation question myself. Here's the eval: AI writing values got X%, AI pointing got Y%, and it raised N of the M ambiguities I'd found by hand."

## 8. Success criteria (check before submitting)

- [ ] A cold visitor gets value without typing (the preset loads).
- [ ] Every number on screen traces to a rule clause or a named assumption.
- [ ] Irregular, corner, tiny and huge plots don't crash (fuzz tests pass).
- [ ] Works on a 390 px phone, and the first view loads in under 3 s on Fast 4G emulation.
- [ ] The shared link reproduces the exact same state.
- [ ] The eval regenerates from the repo with one command.
- [ ] DECISIONS.md lists every call made, with its reason.

## 9. Write-up outline (Kunal writes it; these are the notes to draw from)

The brief's section 5 defines seven parts, which we only see after starting. A likely mapping:

1. **Live tool:** the URL plus the 90-second demo path above.
2. **Code:** the repo, how to run it, the test command, and the architecture diagram.
3. **What I built and why:** the problem from their blog, the user, the scope cuts.
4. **Decisions made without asking:** DECISIONS.md, the top 5 with their reasons.
5. **How I used AI:** the agent setup, the rule compiler (AI points, code copies, invariants check, human decides) and why not AI-checks-AI, the eval results, where AI was kept out (measurements) and why.
6. **Limits and what's next:** coverage, secondary-sourced amendments, premium FAR/TDR, map parcels, the drawings checker on the same engine.
7. **Résumé:** kunalrc.xyz/resume.pdf, or a tailored one.

Tone, matching theirs: plain, specific, numbers with ranges, no hype, and say what isn't known.
