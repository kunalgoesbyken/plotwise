export type Assumption<T> = { readonly value: T; readonly source: string }

export const OSM_ATTRIBUTION = '© OpenStreetMap contributors (ODbL)'

export const HIGHWAY_CLASSES = [
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'unclassified',
  'residential',
  'living_street',
  'service',
  'motorway_link',
  'trunk_link',
  'primary_link',
  'secondary_link',
  'tertiary_link',
] as const

export type HighwayClass = (typeof HIGHWAY_CLASSES)[number]

export const METRES_PER_LEVEL: Assumption<number> = {
  value: 3.3,
  source:
    'assumption: Bangkok residential floor-to-floor 3.0-3.3 m (research/site-data.md); OpenMapTiles building.sql uses 3.66 m',
}

export const DEFAULT_BUILDING_HEIGHT_M: Assumption<number> = {
  value: 5,
  source: 'OpenMapTiles layers/building/building.sql: COALESCE(height, levels * 3.66, 5). Too low for central Bangkok',
}

export const MAX_PLAUSIBLE_HEIGHT_M: Assumption<number> = {
  value: 500,
  source: 'assumption: Bangkok towers peak around 300-330 m, anything taller is a mis-tag',
}

export const LANE_WIDTH_M: Assumption<number> = {
  value: 3.25,
  source: 'assumption: lane width proposed in research/site-data.md',
}

export const MAX_PLAUSIBLE_LANES: Assumption<number> = {
  value: 12,
  source: 'assumption: more lanes than any Bangkok carriageway, treated as a mis-tag',
}

export const MAX_PLAUSIBLE_ROAD_WIDTH_M: Assumption<number> = {
  value: 100,
  source: 'assumption: wider than any Bangkok carriageway, treated as a mis-tag',
}

export const ROAD_WIDTH_BY_CLASS_M: Assumption<Readonly<Record<HighwayClass, number>>> = {
  value: {
    motorway: 18,
    trunk: 18,
    primary: 16,
    secondary: 12,
    tertiary: 8,
    unclassified: 6,
    residential: 5,
    living_street: 4,
    service: 3.5,
    motorway_link: 7,
    trunk_link: 7,
    primary_link: 7,
    secondary_link: 6,
    tertiary_link: 5,
  },
  source: 'assumption: carriageway widths inside the ranges proposed in research/site-data.md; tune against Bangkok surveys',
}

export const SNAP_CELLS_PER_DEGREE: Assumption<number> = {
  value: 500,
  source: 'assumption: 0.002 degree cells (about 220 m) so nearby plots share one cached request',
}

export const MAX_BBOX_SIDE_M: Assumption<number> = {
  value: 1500,
  source:
    'assumption: keeps one Overpass query small enough for a normal laptop to render and the public instances to answer',
}

export const THAILAND_BBOX: Assumption<readonly [number, number, number, number]> = {
  value: [97.3, 5.6, 105.7, 20.5],
  source: 'approximate extent of Thailand (minLng, minLat, maxLng, maxLat), slightly generous',
}

export const SITE_CACHE_S: Assumption<{ browser: number; cdn: number; staleWhileRevalidate: number }> = {
  value: { browser: 3600, cdn: 86_400, staleWhileRevalidate: 604_800 },
  source:
    'assumption: OSM buildings and roads change over weeks, and the public Overpass instances ask apps to cache hard',
}

export const OUTLINE_COVERAGE_RATIO: Assumption<number> = {
  value: 0.9,
  source: 'assumption: a building outline is dropped when its building:parts cover this share of its footprint',
}

export const NEAREST_ROAD_MAX_ANGLE_DEG: Assumption<number> = {
  value: 25,
  source: 'assumption: a road within this angle of a plot edge counts as roughly parallel',
}

export const NEAREST_ROAD_MAX_GAP_M: Assumption<number> = {
  value: 30,
  source:
    'assumption: widest plausible gap between a plot edge and the kerb of the road it faces (verge, footpath, setback)',
}

export const MAX_MEDIAN_WIDTH_M: Assumption<number> = {
  value: 20,
  source:
    'assumption: Bangkok arterial medians run from a kerb strip to the pier line under elevated rail or tollways; the recorded Ratchadaphisek sample has about 6 m between its estimated carriageways. A same-named opposite carriageway farther away is treated as a separate road, such as a frontage road',
}

export const SITE_MARGIN_M: Assumption<number> = {
  value: 200,
  source:
    'assumption: 200 m around the plot covers the street block, the roads it faces and the towers that shade or overlook it; one margin for road suggestions and the 3D context so both share one cached request',
}

export const PLATFORM_MODES: Assumption<readonly string[]> = {
  value: ['train', 'subway', 'light_rail', 'monorail'],
  source:
    'OSM public_transport=platform modes of Bangkok mass transit: BTS and MRT are tagged subway, the Gold Line light_rail, the Pink and Yellow lines monorail, the Airport Rail Link and Red Line train (Overpass, 2026-11-20). train also matches SRT intercity platforms, which OSM does not tag apart',
}

export const STATION_NODE_TYPES: Assumption<readonly string[]> = {
  value: ['subway', 'light_rail', 'monorail'],
  source:
    'OSM station=* values on Bangkok BTS, MRT, Gold Line and monorail station nodes (Overpass, 2026-11-20); Airport Rail Link and Red Line nodes carry only train=yes, like SRT intercity stations, so they are not used',
}

export const STATION_PLATFORM_RADIUS_M: Assumption<number> = {
  value: 50,
  source:
    'measured: of the 69 Bangkok BTS and MRT station nodes with a platform mapped within 100 m, 67 have it within 10 m (Overpass, 2026-11-20); a station node with no platform this close stands in for its platform',
}
