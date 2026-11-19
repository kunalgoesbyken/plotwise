# Plotwise

Bangkok plot feasibility in the browser. Draw a plot on the map, mark the roads it faces, pick a building type, and Plotwise shows the rules that apply, the allowed building envelope, and concept designs with pass/fail checklists, in 3D among the real surrounding buildings. Every change updates live.

**Live:** https://plotwise-ashy.vercel.app

Scope: zone ย.9 (very high-density residential) of the Bangkok Comprehensive Plan B.E. 2556, for condominiums, offices and hotels.

## How it works

```
plot drawn on the map ─► normalized outline (local metres)
                              │
Thai legal PDFs ─► pointers ─► compiled rule pack ─► solve ─► limits + envelope tiers ─► designs + checklists
                              │                                        │
OpenStreetMap (Overpass) ─► /api/site ─────────────────────────────────┴─► map + 3D view
Photon (OSM place search) ─► /api/geocode ─► find a plot by address or place name
```

1. **Rules are compiled, never typed.** `pointers/bkk-y9.json` points at a page, a line and a token in the text of each source PDF (`sources/`). `tools/compile-pack.ts` parses the Thai number at that spot (Thai digits and number words included) into `src/rules/packs/bkk-y9.json`. Every value keeps its citation: source, clause, page, line and the Thai quote. `tools/check-pack.ts` checks ranges, band gaps and overlaps, cross-source agreement and bonus caps, and fails on any undecided interpretation question.
2. **Interpretations are decided by a person.** Where the law is ambiguous, the pack holds a question with its candidate readings. The engine refuses to run until each one has a recorded decision. The Rules panel lists every decision in use with its sources.
3. **Solve.** `src/solve` turns the plot and the pack into limits (FAR and maximum floor area, open space and permeable ground, use conditions, parking). It also produces per-edge setbacks that change with height: road setbacks by road width, neighbour setbacks, the height-to-road rule, and the 6 m high-rise distance. There are two envelopes, ordinary and high-rise, because Thai boundary setbacks apply to the whole building rather than floor by floor.
4. **Geometry.** `src/geometry` builds each envelope from the real outline: a per-edge setback for any polygon (concave and multi-piece included), with tiers clipped by clipper2-ts. The envelope never encroaches on a setback; at rounded corners it can be up to 5 mm too cautious.
5. **Designs.** `src/designs` generates podium + tower, slab and low-rise block concepts inside the envelope, aiming at the floor-area limit. Each comes with a checklist computed from its own geometry. Items the data cannot verify, such as the road network or the station distance, are marked "verify".
6. **Site context.** `/api/site` fetches buildings, roads and mass-transit platforms and stations from OpenStreetMap through Overpass in one request, with failover across instances, and caches them for a day. Stations are searched in a wider box, the pack's station distance plus a margin beyond the site. Road widths, building heights and the distance to the nearest station platform are estimates, so the UI labels them and keeps them editable.
7. **Place search.** `/api/geocode?q=` proxies the public [Photon](https://photon.komoot.io) geocoder, biased to Bangkok and limited to Thailand, and returns places with English and Thai labels. Answers are cached for a week to keep the load on the free service low.

The rule stepper (Plot → Setbacks → Road height → High-rise) rebuilds the envelope one rule group at a time, so you can see what each rule removes.

## Setup

Requires [bun](https://bun.sh) 1.4 or later. No API keys or environment variables are needed.

```sh
bun install
bun run dev            # http://localhost:3000
```

| Task | Command |
|---|---|
| Unit and property tests | `bun test` |
| Browser tests (local production build) | `bun run build && bun run e2e` |
| Browser tests against the live site | `E2E_URL=https://plotwise-ashy.vercel.app bun run e2e` |
| Real-GPU performance numbers (default headless is a software renderer) | add `E2E_GPU=1` |
| Recompile the rule pack | `bun tools/compile-pack.ts bkk-y9` |
| Check the rule pack | `bun tools/check-pack.ts bkk-y9` |
| Type check and lint | `bun run typecheck` (generates Next route types, then runs tsc) and `bun run lint` |

## Code layout

Feature-first folders under `src/`:

| Folder | Responsibility |
|---|---|
| `editor` | Drawing and editing the plot on MapLibre, road edges and widths, building type, URL state |
| `plot`, `geo` | The validated plot contract and the local metric projection |
| `rules` | Rule pack types and loader |
| `solve` | Rules → limits, setbacks by height, envelopes; `assumptions.ts` holds every engineering assumption with its source |
| `geometry` | Polygon normalization, per-edge setback envelopes, tiers, floor plates |
| `designs` | Concept designs, metrics and checklists |
| `site` | Overpass proxy, OSM parsing, height and width estimates, nearest-road and nearest-station suggestions |
| `geocode` | Place search through Photon: query validation, the cached proxy and a typed client |
| `scene` | three.js / react-three-fiber view of the context, envelope and designs |
| `feasibility` | Runs solve + designs once for every panel, plus the Rules and Designs panels and the rule stepper |
| `text` | One typed message dictionary and the number formatter, ready for a Thai translation |

`tools/` holds the rule compiler and checker, `pointers/` the rule pointers, and `sources/` the legal PDFs with their extracted text.

## Sources

- Bangkok Comprehensive Plan B.E. 2556 (Ministerial Regulation, Royal Gazette) and its 2013 correction
- Bangkok bylaw of 13 March 2026 amending the plan (text layer unreadable; treated as factory-only, shown with a banner)
- Ministerial Regulations 55 (building setbacks, open space, height vs road), 33 (high-rise and extra-large buildings) and 7 (parking)
- Bangkok Building Control Bylaw B.E. 2544
- © OpenStreetMap contributors (ODbL); base map by OpenFreeMap / OpenMapTiles

## Known limits

- One zone. Plotwise does not look up a plot's zone; confirm it on the BMA city plan, which the app links to.
- OSM heights exist for about a third of central Bangkok buildings (the rest use a default), and no sampled road had a width tag. Widths come from lanes or road class. A divided road mapped as two one-way carriageways with the same name or reference is suggested kerb to kerb across both and the median (up to a 20 m median), not as one carriageway. The suggestion is still a carriageway estimate, not the legal right-of-way, so road widths stay editable and labelled as estimates.
- Station distance is estimated from OSM and measured from the platform edge, as the plan requires; where no platform is mapped it falls back to the station point and says so. Platform coverage across Bangkok (Overpass, 20 Nov 2026): BTS 52 of 64 stations, MRT 15 of 52, the Pink and Yellow monorail lines 1 of 55. OSM does not tag SRT intercity platforms apart from Airport Rail Link and Red Line ones, so an SRT platform can count as a station, and Red Line stations, which have no platforms mapped, are not found. The station toggle is pre-set from this estimate and stays editable.
- Road-network continuity and planned road widenings are not in any open dataset used here; they are user inputs or "verify" checklist items.
- Place search depends on the public Photon instance, which is free under fair use with no availability guarantee.
- The 2026 amending bylaw's body text could not be machine-read.
