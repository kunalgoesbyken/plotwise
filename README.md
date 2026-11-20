<p align="center"><img src="src/app/icon.svg" width="72" height="72" alt="Plotwise logo: a plot outline with its road edge"></p>

<h1 align="center">Plotwise</h1>

<p align="center">See what a Bangkok plot can hold before you buy it: the floor area the rules allow, concept designs in 3D, what is left to check and a rough first cost.</p>

<p align="center"><a href="https://plotwise-ashy.vercel.app"><b>plotwise-ashy.vercel.app</b></a> · <a href="https://plotwise-ashy.vercel.app/app">open the app</a></p>

<p align="center"><img src="src/landing/app.png" width="900" alt="Plotwise with the example plot: the plot and its buildable area on the map, a podium-and-tower design in 3D among the real buildings, and the results panel"></p>

The app takes three steps:

1. **Plot.** Find the site with live place search, then trace its outline on the map, or start from the example plot.
2. **Roads.** Edges beside a mapped road are pre-marked with an estimated width. You can change any of them.
3. **Results.** The results show:
   - the floor area the rules allow, with the optional FAR bonus;
   - up to three concept designs side by side, each with built-up area, saleable area, parking levels, first cost and supported land value;
   - a pass / check / fail checklist with a clickable "to check" list that says why each item needs checking and who confirms it;
   - how the result changes if the road is 2 m narrower or wider;
   - the rules that apply, with their legal sources;
   - the allowed envelope in 3D among the real surrounding buildings.

Every edit updates the results live. The share link holds the plot, the roads, the building type, the FAR bonus switch and any edited assumption. **Print** gives a one-page summary.

Scope: the brown zone (very high-density residential, coded ย.9) of the Bangkok Comprehensive Plan B.E. 2556, for condominiums, offices and hotels. The landing page is at `/` and the app is at `/app`. Old share links on the root still open in the app.

## How it works

```
plot drawn on the map ─► normalized outline (local metres)
                              │
Thai legal PDFs ─► pointers ─► compiled rule pack ─► solve ─► limits + envelope tiers ─► designs + checklists ─► money estimates
                              │                                        │
OpenStreetMap (Overpass) ─► /api/site ─────────────────────────────────┴─► map + 3D view
Photon (OSM place search) ─► /api/geocode ─► live suggestions while typing
BMA city-plan layer (ArcGIS) ─► /api/zone ─► is the plot in the covered zone?
```

1. **Rules are compiled, never typed.**
   - `pointers/bkk-y9.json` points at a page, a line and a token in the text of each source PDF in `sources/`.
   - `tools/compile-pack.ts` parses the Thai number at that spot (Thai digits and number words included) into `src/rules/packs/bkk-y9.json`.
   - Every value keeps its citation: source, clause, page, line and the Thai quote. The interface names each source in English with its page and line, and links the official PDF.
   - `tools/check-pack.ts` checks ranges, band gaps and overlaps, cross-source agreement and bonus caps. It fails on any undecided interpretation question.
2. **Interpretations are decided by a person.** Where the law is ambiguous, the pack holds a question with its candidate readings. The engine refuses to run until each one has a recorded decision.
3. **Solve.** `src/solve` turns the plot and the pack into limits: FAR (standard or with the bonus), open space, use conditions and parking.
   - It also produces per-edge setbacks that change with height: road setbacks by road width, neighbour setbacks, the height-to-road rule and the 6 m high-rise distance.
   - There are two envelopes, ordinary and high-rise.
4. **Geometry.** `src/geometry` builds each envelope from the real outline, with tiers clipped by clipper2-ts. It works for any polygon, including concave and multi-piece outlines.
5. **Designs.** `src/designs` generates podium-and-tower, slab and low-rise block concepts inside the envelope. Each gets a checklist computed from its own geometry. Items the data cannot confirm are marked "check".
6. **Money.** `src/finance` estimates:
   - saleable area, and parking levels above ground and in basements;
   - a first-cost range split into substructure, superstructure and services;
   - the land value each design supports (a residual).

   Every rate and price is an editable assumption with its source, shown as "estimated". None of it is law.
7. **Site, search and zone.** Server routes proxy OpenStreetMap (Overpass), Photon and the BMA city-plan layer, with caching and input validation at the boundary. Road widths, building heights, station distance and the zone verdict are labelled as estimates or as unchecked, and stay editable.

## Region and design system

- **Region.** Everything specific to a jurisdiction lives in one record, `src/region/regions.ts`:
  - the rule pack, city and country names, zone label and authority;
  - city-plan link, map start, search bounds and bias;
  - OSM transit tags.

  Money defaults are in `MONEY_REGIONS` in `src/solve/assumptions.ts`, and the zone layer is in `src/zone/sources.ts`, both keyed by region. `NEXT_PUBLIC_REGION` picks the active region.

  Adding a city whose rules have the same shape is a data change: a rule pack, a region record, money defaults and a zone source. The pack schema still has Thai-law shapes, such as height-banded setbacks and the parking scopes. Rules of a different kind would need schema and solver work.
- **Design tokens.** Colours, fonts, radii, type scale, shadows and motion are defined once in `src/app/globals.css` (`@theme`). The map and the 3D scene read the same tokens at runtime. Components use token names only. The UI uses Geist, Phosphor icons and shadcn/ui on Radix.

## Setup

Requires [bun](https://bun.sh) 1.4 or later. No API keys or environment variables are needed.

```sh
bun install
bun run dev            # http://localhost:3000 (landing), /app (the app)
```

| Task | Command |
|---|---|
| Unit and property tests for the numbers: rules, geometry, solver, designs, site data, input validation | `bun test` |
| Browser tests (local production build) | `bun run build && bun run e2e` |
| Browser tests against the live site | `E2E_URL=https://plotwise-ashy.vercel.app bun run e2e` |
| Real-GPU performance numbers (default headless is a software renderer) | add `E2E_GPU=1` |
| Recompile / check the rule pack | `bun tools/compile-pack.ts bkk-y9` / `bun tools/check-pack.ts bkk-y9` |
| Type check and lint | `bun run typecheck` and `bun run lint` |

## Code layout

Feature-first folders under `src/`:

| Folder | Responsibility |
|---|---|
| `editor` | The three-step panel, drawing and editing the plot on MapLibre, roads, building type, live place search, URL state |
| `plot`, `geo` | The validated plot contract and the local metric projection |
| `rules` | Rule pack types and loader |
| `solve` | Rules → limits, setbacks by height, envelopes; `assumptions.ts` holds every engineering and money assumption with its source |
| `geometry` | Polygon normalization, per-edge setback envelopes, tiers, floor plates |
| `designs` | Concept designs, metrics and checklists |
| `finance` | Saleable area, parking levels, first cost, land value, the assumptions panel and their share-link encoding |
| `feasibility` | Runs solve + designs once for every panel; Designs, Rules, to-check, road-width sensitivity, FAR bonus, share |
| `region` | The active jurisdiction as data |
| `zone` | City-plan zone lookup through the BMA ArcGIS layer |
| `site` | Overpass proxy, OSM parsing, height and width estimates, nearest-road and nearest-station suggestions |
| `geocode` | Place search through Photon |
| `scene` | three.js / react-three-fiber view of the context, envelope and designs |
| `report` | The one-page printable summary |
| `landing` | The landing page, built from the real example plot's figures |
| `ui` | shadcn/ui components on Radix, the logo, and shared panel pieces |
| `text` | One typed message dictionary and the number formatter |

## Sources

- Bangkok Comprehensive Plan B.E. 2556 (Ministerial Regulation, Royal Gazette) and its 2013 correction
- Bangkok bylaw of 13 March 2026 amending the plan (text layer unreadable; treated as factory-only, shown with a note)
- Ministerial Regulations 55 (building setbacks, open space, height vs road), 33 (high-rise and extra-large buildings) and 7 (parking)
- Bangkok Building Control Bylaw B.E. 2544
- BMA City Planning GIS, comprehensive plan 2556 land-use layer (queried live, not stored)
- © OpenStreetMap contributors (ODbL); base map by OpenFreeMap / OpenMapTiles

## Known limits

- **One zone.** The zone check needs the BMA city-plan service, which answers only from Thai networks. Elsewhere the app says the zone was not checked and links the official map.
- **Money figures are first-look estimates, not valuations.**
  - No published Bangkok construction cost per m² was found, so the build rates are labelled unsourced.
  - Sale prices and the margin come from the cited market reports.
  - Every value is editable and travels in the share link.
- **OSM coverage.**
  - Heights exist for about a third of central Bangkok buildings, and roads carry no width tags, so widths come from lanes or road class.
  - Road widths are carriageway estimates, not the legal right-of-way, so they stay editable and labelled.
  - Station distance comes from OSM platforms. Coverage is partial: BTS 52 of 64, MRT 15 of 52, and the monorail lines 1 of 55.
- **Road-network continuity** and planned road widenings are not in any open dataset used here. They appear in the "to check" list.
- **The 2026 amending bylaw's** body text could not be machine-read.
