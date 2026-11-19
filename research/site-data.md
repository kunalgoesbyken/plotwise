# Free site data for Bangkok plots: primer (2026-11-19)

Method note: 8 Context.dev calls (cap reached). Every claim has a source URL. Anything not covered by a fetched source is tagged UNVERIFIED. No Bangkok-specific coverage statistics were found, so the coverage questions are open.

## 1. Key findings

### Buildings
- **OSM via Overpass is the one source with confirmed free, keyless, bbox-queryable access.**
  - Main instance: `https://overpass-api.de/api/interpreter`. Policy: under 10,000 queries/day AND under 1 GB/day AND under 10 min total processing is "fine". If you build an app or website, your users' requests count toward that sum, and you should send `User-Agent` or `Referer`. https://wiki.openstreetmap.org/wiki/Overpass_API
  - Other public instances, no key. VK Maps: `https://maps.mail.ru/osm/tools/overpass/api/interpreter`, "no requests limitations". Private.coffee: `https://overpass.private.coffee/api/interpreter`, "no rate limit", but asks to be notified before large-scale use. Same wiki page.
- **OSM height/levels coverage in Bangkok: UNVERIFIED.** What I found is not Bangkok-specific:
  - Global study: 4.6% of buildings have `building:levels`, 2.9% have `height`, 7% have at least one. https://filipbiljecki.com/publications/2023_bae_osm_qa.pdf
  - Southeast Asia study (includes Thailand): only a fraction of mapped buildings have height info, and completeness is highly heterogeneous. Some small precincts are fully complete. https://isprs-annals.copernicus.org/articles/VI-4-W1-2020/37/2020/isprs-annals-VI-4-W1-2020-37-2020.pdf
  - Conclusion: run one Overpass count over a few central-Bangkok bboxes before committing (see Open questions).
- **Overture Maps buildings**
  - It merges several sources. OSM has the highest conflation priority. ML roofprints from Microsoft and Google Open Buildings fill gaps. Height attributes are merged between matched footprints (IoU > 0.5). https://docs.overturemaps.org/guides/buildings/
  - The same guide says ML-derived footprints have lower precision, most pronounced in the Global South.
  - Overture height coverage for Thailand/Bangkok: UNVERIFIED. For scale only, one non-Thai example: heights were missing for 86% of Bristol's buildings. https://www.technicalgis.com/tutorials/geoparquet-duckdb-overture-maps/
  - Access:
    - CLI: `overturemaps download --bbox=W,S,E,N -f geojson --type=building -o out.geojson`. https://docs.overturemaps.org/getting-data/overturemaps-py/
    - Hosted PMTiles for buildings, with a `pmtiles extract ... --bbox=` CLI. Example URL in the docs: `https://overturemaps-extras-us-west-2.s3.amazonaws.com/tiles/2026-11-18.0/buildings.pmtiles`. https://docs.overturemaps.org/examples/overture-tiles/
    - DuckDB over GeoParquet. A bbox query selects buildings whose bbox overlaps the area, so some hang over the edge. Overture publishes monthly and keeps only recent releases, so resolve `latest` from STAC. https://www.technicalgis.com/tutorials/geoparquet-duckdb-overture-maps/
  - UNVERIFIED: whether the PMTiles carry `height`/`num_floors`. UNVERIFIED: whether the browser can range-read the remote PMTiles directly (CORS). UNVERIFIED: the licence of the buildings theme.
- **Google Open Buildings 2.5D Temporal**
  - Covers Thailand (THA is in the country list). Annual 2016-2023. Per-pixel rasters of building presence, count and height. Built from Sentinel-2, effective resolution about 4 m. Licence CC BY-4.0 or ODbL v1.0. https://sites.research.google/gr/open-buildings/temporal/
  - It is a raster, not footprints, and the data ends at 2023. Use it only as a height prior if OSM and Overture both lack height. How to fetch it by bbox without Earth Engine: UNVERIFIED.
- **Microsoft footprints:** not researched directly. Overture already merges Microsoft ML buildings (same Overture guide). Thailand coverage by itself: UNVERIFIED.

**Recommendation**
- Primary: OSM via Overpass. It is live, bbox-queryable, has ODbL attribution, supports `building:part`, and is the highest-priority source inside Overture.
- Fallback: Overture buildings, pre-extracted for Bangkok into a static file/PMTiles and shipped with the app or hosted on Vercel static. Use it where OSM has no footprint, and for its merged heights. Test Overture height coverage for Thailand first.
- Default-height rule, with OpenMapTiles' own rule as the reference: `ceil(COALESCE(height, levels * 3.66, 5))`, and min height `COALESCE(min_height, min_level * 3.66, 0)`. https://github.com/openmaptiles/openmaptiles/blob/master/layers/building/building.sql
  - Proposed (my judgment, not sourced): `height` tag, else `building:levels * 3.66` (or 3.0-3.3 for residential), else 5 m. In central Bangkok 5 m will often be far too low, so make the default editable in the UI and mark untagged buildings in a different colour.

### Basemap with building heights
- OpenFreeMap needs no API key. MapLibre style: `https://tiles.openfreemap.org/styles/liberty`. Custom styles must be self-hosted. Vite needs `setWorkerUrl` with the maplibre worker (code in the quick start). https://openfreemap.org/quick_start/
- OpenMapTiles `building` layer fields: `render_height`, `render_min_height`, `colour`, `hide_3d`. `render_height` is "approximated height from levels and height". Outline buildings are `hide_3d`. https://openmaptiles.org/docs/schema/ , https://github.com/openmaptiles/openmaptiles/blob/master/layers/building/building.yaml
- UNVERIFIED: that OpenFreeMap serves exactly the OpenMapTiles schema with `render_height`, and its usage limits and attribution text. Check the tile JSON at `https://tiles.openfreemap.org/planet`, and the OpenFreeMap terms page.
- Implication: MapLibre `fill-extrusion` can show the context 3D in the 2D map for free. But vector-tile geometry is clipped at tile edges, and `render_height` is an integer in metres. For the three.js scene, prefer the Overpass geometry with its own tags, and use OpenFreeMap only for the 2D map and a quick preview.

### Roads
- OSM `width=*` is the real width of a way. For streets, `width` now means the carriageway kerb to kerb, including on-carriageway parking lanes, and excluding sidewalks. Sidewalk/cycleway width is `sidewalk:*:width`, `cycleway:*:width`. Related keys: `width:lanes`, `est_width`, `maxwidth`. https://wiki.openstreetmap.org/wiki/Key:width and https://wiki.openstreetmap.org/wiki/Key:width:carriageway
- Bangkok coverage of `width`/`lanes`/`sidewalk` tags: UNVERIFIED. The sourced page does not give default widths per highway class.
- Fallback (your proposal, not sourced): `lanes * 3.25 m`, else a default per `highway` class (my starting values: trunk/primary about 14-20 m, secondary 10-14, tertiary 7-10, residential/soi 4-6; unsourced, to be tuned).
- Thai regulations: UNVERIFIED. I did not research them. OSM `width` is carriageway only, whereas a Thai "public road width" check may mean the full right-of-way (kerb + footpath + verge). Get the legal definition before showing a compliance number.
- Method for the road the plot faces: from the Overpass `way[highway]` results, find the nearest road segment to the plot polygon edge (in the local metric frame). The distance to the opposite side is about the road width plus offsets. Show it as "estimated", with the tag source (`width` / `lanes` / default).

### Overpass from the browser and caching
- CORS behaviour of overpass-api.de: UNVERIFIED (not in fetched sources).
- Recommendation: call it from a small Vercel function (also lets you set a proper `User-Agent`, per the usage policy) and cache by rounded bbox/tile. Edge-cache headers and function limits on Vercel: UNVERIFIED (not researched). Also hit a second instance (private.coffee) on a 429/504 as a fallback.
- Policy note: the main instance counts all your users' requests together, so cache.

### Coordinate handling
- UNVERIFIED (not researched in this run). The suggestion from the brief is EPSG:32647 (UTM 47N) or a local tangent plane. For a ~500 m area, a local equirectangular/tangent projection around the plot centroid (x = dLon*cos(lat0)*R, y = dLat*R) is simple and accurate enough; or `proj4` with `+proj=utm +zone=47 +datum=WGS84`. Verify the `proj4` API and the zone for Bangkok (about 100.5 deg E) before use.

### Gotchas
1. `building` vs `building:part`: OpenMapTiles has to treat both, and marks building outlines as `hide_3d` so they are not extruded together with their parts. If you draw both an outline and its parts you get double geometry. https://github.com/openmaptiles/openmaptiles/blob/master/layers/building/building.yaml . Your Overpass query must fetch both, and you must hide outlines that have parts.
2. Missing heights are the norm (see percentages above), and an Overture bbox query returns edge-overlapping buildings. https://www.technicalgis.com/tutorials/geoparquet-duckdb-overture-maps/
3. Multipolygon buildings (relations) need ring assembly and holes before triangulation; courtyards matter. UNVERIFIED by source; this is an engineering point from how Overpass returns relation members. Also UNVERIFIED: how dense OSM `soi` (side-street) mapping is in Bangkok. Compare against the satellite basemap.

## 2. Recommended pipeline
1. User draws a polygon in MapLibre, giving lon/lat. Take the centroid, set the local origin there, and compute a bbox about 300-500 m around it.
2. `fetch('/api/site?bbox=...')` goes to a Vercel function. It rounds the bbox, checks its cache, and posts the Overpass query (below) to overpass-api.de with a `User-Agent`. On error it tries private.coffee.
3. If the number of buildings with height or levels is too low, merge in the Overture extract for the same bbox (static PMTiles/GeoJSON). Apply the default-height rule. Flag each building as `height_source: osm | levels | default`.
4. Convert with a local projection to metres around the plot. Assemble multipolygon rings, drop `building` outlines that have `building:part` children, and compute the height per the rule.
5. Build three.js meshes. `THREE.Shape` with holes plus `ExtrudeGeometry` (depth = height - min_height, translated up by min_height). Merge into one `BufferGeometry` for speed on laptops. Extrude the user plot in a highlight colour.
6. Roads: take `highway` ways, offset the centreline by half width into a flat ribbon/polygon, and draw it at y = 0. Pick the nearest way to the plot and compute width (tag, lanes, or class default) and the distance to the opposite side.
7. Show the source and estimate flags in the UI. Render OSM/Overture attribution on the map and in the 3D view.
8. Optional: a static pre-baked Bangkok test set for demos, in case Overpass is slow.

### Example Overpass query (standard Overpass QL; bbox order is south,west,north,east)
```
[out:json][timeout:25];
(
  way["building"](13.7370,100.5290,13.7430,100.5350);
  relation["building"](13.7370,100.5290,13.7430,100.5350);
  way["building:part"](13.7370,100.5290,13.7430,100.5350);
  way["highway"](13.7370,100.5290,13.7430,100.5350);
);
out body geom;
```
Coordinates are placeholders, not a real plot. Run it once in Overpass Turbo to check tags (`height`, `building:levels`, `min_height`, `width`, `lanes`). Whether `out geom` gives complete relation rings: UNVERIFIED.

## 3. Limits and licences
- OSM data: ODbL, attribution required. Licence text not fetched in this run: UNVERIFIED. The attribution wording "OpenStreetMap contributors" is the standard one but was not verified by a fetched source.
- Overpass usage policy: see above (10,000 queries/day, 1 GB/day, 10 min; app usage is summed; send `User-Agent`/`Referer`).
- Google Open Buildings 2.5D: CC BY-4.0 or ODbL, with Copernicus Sentinel acknowledgement. https://sites.research.google/gr/open-buildings/temporal/
- Overture buildings licence: UNVERIFIED. The guide says the theme combines several sources and has a "Sources and licensing" section, but I only saw the source list. https://docs.overturemaps.org/guides/buildings/
- OpenFreeMap terms/attribution: UNVERIFIED.

## 4. Open questions
- What share of buildings in a few central Bangkok bboxes (e.g. Sukhumvit, Silom, Ari) have `height`/`building:levels`? Count with Overpass (`out count;`). Same for Overture heights in Thailand.
- Do Overture PMTiles include height? Can the browser read the remote PMTiles directly (CORS), or do we extract Bangkok and host the static file?
- Does the OpenFreeMap tileset expose `render_height`? What are its fair-use limits?
- Overpass CORS from the browser; Vercel edge caching and function time limits.
- Thai rules: which road width and distance definition applies (carriageway vs full right-of-way)? Need the exact legal definition before showing a pass/fail.
- Default building height: acceptable accuracy for the demo vs. showing "unknown height" visually.
- Projection library choice: confirm `proj4` (or a hand-rolled tangent plane) and the UTM zone.
