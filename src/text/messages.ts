import type { CheckId, TypologyId } from '@/designs'
import type { GeometryErrorReason } from '@/geometry'
import type { BuildingType } from '@/plot/plot'
import type { EnvelopeKind } from '@/solve'

export const LOCALE = 'en'

type Message = string | ((params: never) => string)

const pluralRules = new Intl.PluralRules(LOCALE)
const plural = (count: number, one: string, other: string) => `${count} ${pluralRules.select(count) === 'one' ? one : other}`

type Count = { count: number }
type Verb = { verb: string }
type Num = { number: string }
type Area = { area: string }
type Zone = { zone: string }

type EngineMessages = Record<`check.${CheckId}`, string> &
  Record<`design.${TypologyId}` | `design.${TypologyId}.summary`, string> &
  Record<`building.${BuildingType}`, string> &
  Record<`feasibility.failed.${GeometryErrorReason | 'unknown'}`, string> &
  Record<`limit.envelope-top.${EnvelopeKind}` | `limit.envelope-top.${EnvelopeKind}.detail`, string>

const en = {
  'app.name': 'Plotwise',
  'app.city': 'Bangkok',

  'verb.click': 'Click',
  'verb.tap': 'Tap',

  'unit.m': ({ number }: Num) => `${number} m`,
  'unit.sqm': ({ number }: Num) => `${number} m²`,
  'unit.rooms': ({ number }: Num) => `${number} rooms`,

  'building.condo': 'Condominium',
  'building.office': 'Office',
  'building.hotel': 'Hotel',

  'shell.panel': 'Plot settings',
  'shell.tabs': 'Panels',
  'shell.waiting.rules': 'Once the outline is closed and every road has a width, the limits for this plot appear here, each with its legal source.',
  'shell.waiting.designs': 'Once the outline is closed and every road has a width, at least two concept designs appear here, each with a pass/fail checklist.',
  'shell.waiting.view3d': 'Once the outline is closed and every road has a width, the allowed envelope and the designs appear here in 3D.',
  'tab.site': 'Site',
  'tab.rules': 'Rules',
  'tab.designs': 'Designs',
  'tab.view3d': '3D',
  'section.view3d': '3D view',

  'rejection.crossing': 'Edges can’t cross or overlap. Try another point.',
  'rejection.degenerate': 'These corners are too close together or all in a line to make a plot.',
  'rejection.out-of-range': 'That point is too far from the rest of the plot.',
  'rejection.too-few-corners': 'A plot needs at least 3 corners.',
  'rejection.too-many-corners': ({ count }: Count) => `A plot can have up to ${count} corners.`,

  'hint.label.not-allowed': 'Not allowed',
  'hint.label.corner': ({ name }: { name: string }) => `Corner ${name}`,
  'hint.label.outline': 'Outline',
  'hint.label.frontage': 'Frontage',
  'hint.label.ready': 'Ready',
  'hint.corner': 'Drag to move it, or delete it.',
  'hint.start': ({ verb }: Verb) => `${verb} the map to place the first corner of the plot.`,
  'hint.place': ({ verb }: Verb) => `${verb} to place the next corner.`,
  'hint.close': ({ verb }: Verb) => `${verb} corner A to close the outline.`,
  'hint.road': ({ verb }: Verb) => `${verb} each edge that faces a road.`,
  'hint.width': ({ edge }: { edge: string }) => `Enter the width of the road on edge ${edge}.`,
  'hint.done': 'Drag a corner to reshape the plot. Drag an edge’s midpoint to add a corner.',
  'action.undo-corner': 'Undo corner',
  'action.close-outline': 'Close outline',
  'action.delete-corner': 'Delete corner',

  'plot.title': 'Plot',
  'plot.corners': ({ count }: Count) => plural(count, 'corner', 'corners'),
  'plot.start': ({ verb }: Verb) => `${verb} the map at each corner of the plot boundary, then close the outline on the first corner.`,
  'plot.example': 'Use an example plot',
  'plot.closed': 'Outline closed',
  'plot.drawing': 'Drawing the outline',
  'plot.clear': 'Clear and redraw',

  'frontage.title': 'Road frontage',
  'frontage.waiting': 'Close the outline, then mark the edges that face a road.',
  'frontage.roads': ({ count }: Count) => plural(count, 'road', 'roads'),
  'frontage.width-label': ({ edge }: { edge: string }) => `Road width on edge ${edge}, in metres`,
  'frontage.width-placeholder': 'width',
  'frontage.metres': 'm',
  'frontage.estimated': 'Estimated from OpenStreetMap. Check it on site.',
  'frontage.estimated-tag': 'est.',
  'frontage.boundary': 'Neighbour',
  'frontage.remove': 'Remove',
  'frontage.remove-label': ({ edge }: { edge: string }) => `Remove road on edge ${edge}`,
  'frontage.mark': 'Mark as road',
  'frontage.mark-label': ({ edge }: { edge: string }) => `Mark edge ${edge} as a road`,
  'map.road-width-unknown': '? m',

  'building-type.title': 'Building type',
  'zone.title': 'Zone',
  'zone.name': ({ code }: { code: string }) => `${code} · very high-density residential (brown)`,
  'zone.scope': 'Plotwise covers this one zone of the Bangkok Comprehensive Plan B.E. 2556. Confirm the plot sits in it before relying on the numbers.',
  'zone.check': 'Check the zone on the BMA city plan',
  'transit.title': 'Mass transit',
  'transit.near': ({ distance }: { distance: string }) => `Within ${distance} of a BTS/MRT station`,

  'feasibility.working': 'Working out the rules for this plot…',
  'feasibility.failed.non-finite': 'A corner of this outline has no valid position. Move or delete it to continue.',
  'feasibility.failed.out-of-range': 'This outline is too large to assess. Draw a single plot of land.',
  'feasibility.failed.degenerate': 'This outline is too thin to hold a building. Move a corner to widen it.',
  'feasibility.failed.self-intersecting': 'This outline crosses itself. Move a corner so its edges do not overlap.',
  'feasibility.failed.invalid-setbacks': 'The setbacks could not be applied to this outline. Try reshaping the plot.',
  'feasibility.failed.invalid-tiers': 'The allowed envelope could not be built for this outline. Try reshaping the plot.',
  'feasibility.failed.invalid-floor-height': 'The floor heights for this building type are invalid. Pick another building type.',
  'feasibility.failed.invalid-cap': 'The floor-area limit could not be applied to this plot. Try reshaping it.',
  'feasibility.failed.unknown': 'Something went wrong while checking this plot. Move a corner or change a road width to try again.',

  'source.toggle': ({ count }: Count) => (count === 1 ? 'Source' : `Sources (${count})`),
  'source.location': ({ page, line }: { page: number; line: number }) => ` · p. ${page}, line ${line}`,
  'source.quote': ({ quote }: { quote: string }) => `“${quote}”`,

  'range.between': ({ min, max }: { min: string; max: string }) => `${min} and ${max}`,
  'range.span': ({ min, max }: { min: string; max: string }) => `${min} to ${max}`,
  'range.any': 'any size',

  'value.far': ({ ratio }: { ratio: string }) => `${ratio} : 1`,
  'value.bonus': ({ share }: { share: string }) => `+${share}`,
  'value.multiple': ({ multiple }: { multiple: string }) => `${multiple} × distance`,
  'value.none': 'None',
  'value.met': 'Met',
  'value.not-met': 'Not met',
  'value.permitted': 'Permitted',

  'rules.zone': ({ zone }: { zone: string }) => `Zone ${zone} · high-density residential`,
  'rules.plot-area': ({ area }: Area) => `Plot ${area}`,
  'rules.bylaw.title': '2026 plan amendment: read with care',
  'rules.bylaw.factories-only': ({ zone }: Zone) =>
    `The Bangkok bylaw of 13 Mar 2026 amends this plan, but its body text could not be machine-read. Its readable parts change only factory uses, so the ${zone} values below are treated as unchanged. Confirm with the BMA before relying on them.`,
  'rules.bylaw.unverified': ({ zone }: Zone) =>
    `The Bangkok bylaw of 13 Mar 2026 amends this plan, but its body text could not be machine-read. Every ${zone} value below is unverified against it. Confirm with the BMA before relying on them.`,
  'rules.estimated-roads': ({ edges }: { edges: string }) =>
    `The road width on ${edges} is estimated from OpenStreetMap. Setbacks, height and use limits depend on it, so measure it on site.`,
  'rules.group.floor-area': 'Floor area',
  'rules.group.open-space': 'Open space',
  'rules.group.setbacks': 'Setbacks',
  'rules.group.height': 'Height',
  'rules.group.high-rise': 'High-rise access',
  'rules.group.use': ({ building }: { building: string }) => `Use · ${building}`,
  'rules.group.parking': 'Parking',
  'rules.group.interpretations': 'Interpretations',
  'rules.setbacks.detail': 'Distance the building keeps from each edge at ground level. Above that, the height-to-road rule steps it back further.',
  'rules.setbacks.edge': 'Edge',
  'rules.setbacks.faces': 'Faces',
  'rules.setbacks.ordinary': ({ height }: { height: string }) => `Under ${height}`,
  'rules.setbacks.highRise': ({ height }: { height: string }) => `${height} and up`,
  'rules.setbacks.boundary': 'Neighbour',
  'rules.setbacks.road': ({ width }: { width: string }) => `Road ${width}`,

  'limit.far': 'Floor area ratio',
  'limit.far.detail': ({ area }: Area) => `At most ${area} of total floor area on this plot.`,
  'limit.far-bonus': 'FAR bonus',
  'limit.far-bonus.detail': ({ area, measures }: Area & { measures: string }) =>
    `Up to ${area} if the plan’s bonus measures are provided (${measures}). The designs below do not use it.`,
  'bonus.affordableHousing': 'affordable housing',
  'bonus.publicOpenSpace': 'public open space',
  'bonus.publicParking': 'public parking near a station',
  'bonus.floodRetention': 'flood retention',
  'bonus.energyRating': 'energy rating',
  'limit.open-space-ratio': 'Open space ratio',
  'limit.open-space-ratio.detail': ({ area }: Area) => `Of total floor area: ${area} at the maximum floor area.`,
  'limit.permeable': 'Permeable ground',
  'limit.permeable.required': 'Of the open space the plan requires, planted on soil water can soak into.',
  'limit.permeable.provided': 'Of all open space left on the plot, planted on soil water can soak into.',
  'limit.open-space-minimum': 'Building-control open space',
  'limit.open-space-minimum.largestFloorArea.anyBuilding': 'Of the largest floor, for any building.',
  'limit.open-space-minimum.largestFloorArea.highRiseOrExtraLarge': 'Of the largest floor, for a high-rise or extra-large building.',
  'limit.open-space-minimum.landArea.anyBuilding': 'Of the land, for any building.',
  'limit.open-space-minimum.landArea.highRiseOrExtraLarge': 'Of the land, for a high-rise or extra-large building.',
  'limit.height-plan': 'Height limit in the plan',
  'limit.height-plan.detail': ({ zone }: Zone) => `${zone} sets no height of its own; the rules below cap it.`,
  'limit.height-vs-road': 'Height against road',
  'limit.height-vs-road.detail': ({ multiple }: { multiple: string }) =>
    `No point may be taller than ${multiple} times its distance to the far side of the road.`,
  'limit.high-rise-from': 'High-rise from',
  'limit.high-rise-from.detail': 'From this height, high-rise rules apply: more space all round, a fire lane and wider road access.',
  'limit.envelope-top.ordinary': 'Envelope top, ordinary',
  'limit.envelope-top.ordinary.detail': 'The tallest whole floor that stays below the high-rise threshold.',
  'limit.envelope-top.highRise': 'Envelope top, high-rise',
  'limit.envelope-top.highRise.detail': 'Where the height-to-road rule closes the envelope.',
  'limit.high-rise-access': ({ area }: Area) => `Floor area ${area}`,
  'limit.high-rise-access.detail': ({ road, frontage }: { road: string; frontage: string }) =>
    `Needs a road ${road} wide with frontage ${frontage} on it.`,
  'limit.fire-lane': 'Fire lane around the building',
  'limit.fire-lane.detail': 'Clear ground for fire engines on every side of a high-rise.',
  'limit.high-rise-far': 'High-rise FAR cap',
  'limit.high-rise-far.detail': 'The building-control cap; the plan’s lower ratio governs.',
  'limit.use.permitted': 'No size condition',
  'limit.use.permitted.detail': ({ zone }: Zone) => `This use is not on the ${zone} list of restricted uses.`,
  'limit.use.rooms': 'Rooms',
  'limit.use.operatingAreaSqm': 'Operating area',
  'limit.use.unless': ({ road, station, status }: { road: string; station: string; status: string }) =>
    `Larger needs a road ${road} wide or a station ${station} away. ${status}`,
  'limit.use.exemption.none': 'Neither applies here, so the designs keep to the limit.',
  'limit.use.exemption.station': 'You marked a station nearby: verify the distance on site.',
  'limit.use.exemption.road': ({ edge }: { edge: string }) => `The road on edge ${edge} qualifies.`,

  'parking.scope.bangkokBylaw': 'Bangkok building bylaw',
  'parking.scope.ministerialInnerBangkok': 'Ministerial Regulation 7, inner Bangkok',
  'parking.per-unit': ({ spaces, unit }: { spaces: number; unit: string }) => `${spaces} per unit of ${unit}.`,
  'parking.per-floor-area': ({ area, from }: Area & { from: string }) => `1 per ${area} of floor area, for offices of ${from}.`,
  'parking.per-room-tiers': ({ spaces, rooms, then }: { spaces: number; rooms: number; then: string }) =>
    `${spaces} for the first ${rooms} rooms, then ${then}.`,
  'parking.room-tier': ({ rooms, upto }: { rooms: number; upto: number }) => `1 per ${rooms} rooms up to ${upto}`,
  'parking.room-tier-beyond': ({ rooms }: { rooms: number }) => `1 per ${rooms} rooms beyond`,
  'parking.per-lobby': ({ lobby, shops }: { lobby: string; shops: string }) => `1 per ${lobby} of lobby and 1 per ${shops} of shops.`,
  'parking.large': ({ area }: Area) => `A large building needs at least 1 per ${area} of floor area.`,

  'interpretation.intro': 'Where the texts are ambiguous, the engine uses one reading. Each is listed with the reading in use.',
  'interpretation.decided': 'Decided',
  'interpretation.why': 'Why this reading',

  'design.podium-tower': 'Podium and tower',
  'design.podium-tower.summary': 'A wide podium with a slender tower set back above it.',
  'design.slab': 'Slab on the main road',
  'design.slab.summary': 'One deep block along the widest road, as tall as the rules allow.',
  'design.low-rise': 'Low-rise block',
  'design.low-rise.summary': 'Stays under the high-rise threshold: simpler rules, fewer floors.',
  'design.show': ({ name }: { name: string }) => `Show ${name} in 3D`,
  'design.view': 'Show in 3D',
  'design.shown': 'In 3D',
  'design.checklist': 'Checklist',
  'designs.none': 'No design fits this plot under these rules. Try a wider road, a larger plot or another building type.',

  'limited-by.far': 'Limited by the floor area ratio.',
  'limited-by.building-class': ({ height }: { height: string }) =>
    `Limited by the high-rise rules, which apply from ${height} tall or to an extra-large floor area.`,
  'limited-by.use': 'Limited by the zone’s size condition for this use.',
  'limited-by.use-unless': ({ road, station }: { road: string; station: string }) =>
    `Limited by the zone’s size condition for this use: going larger needs a ${road} road or a station within ${station}.`,
  'limited-by.envelope': 'Limited by the allowed envelope.',

  'metric.gfa-of-max': ({ max }: { max: string }) => `of ${max} max floor area`,
  'metric.far': 'FAR',
  'metric.height': 'Height',
  'metric.storeys': 'Storeys',
  'metric.parking': 'Parking',
  'metric.open-space': 'Open space',
  'metric.units': 'Units',
  'metric.rooms': 'Rooms',
  'metric.net-area': 'Net area',
  'metric.spaces': ({ count }: { count: string }) => `${count} spaces`,

  'summary.label': 'Results for the design shown in 3D',
  'summary.floor-area': 'Floor area',
  'summary.max-floor-area': 'Max allowed',

  'status.pass': 'Pass',
  'status.fail': 'Fail',
  'status.manual': 'Verify',
  'tally.pass': ({ count }: Count) => `${count} pass`,
  'tally.fail': ({ count }: Count) => `${count} fail`,
  'tally.manual': ({ count }: Count) => `${count} to verify`,

  'check.manual': 'Verify on site or with the authority',
  'check.far': 'Floor area within the FAR limit',
  'check.high-rise-far': 'FAR within the high-rise cap',
  'check.open-space-ratio': 'Open space ratio',
  'check.permeable': 'Permeable ground',
  'check.open-space-minimum': 'Building-control open space',
  'check.boundary-setback': 'Setback from neighbours',
  'check.road-setback': 'Setback from the road',
  'check.height-vs-road': 'Height against road width',
  'check.front-open-space': 'Open space facing the road',
  'check.use-size': 'Size allowed for this use',
  'check.use-station': 'Station within reach',
  'check.use-road-width': 'Road wide enough for this use',
  'check.road-access-frontage': 'Frontage on that road',
  'check.road-access-network': 'Road network beyond the plot',
  'check.high-rise-access': 'High-rise road frontage',
  'check.high-rise-road-network': 'High-rise access road beyond the plot',
  'check.fire-lane': 'Fire lane around the building',

  'step.label': 'Rules that carve the envelope',
  'step.plot': 'Plot',
  'step.setbacks': 'Setbacks',
  'step.height-vs-road': 'Road height',
  'step.high-rise': 'High-rise',
  'step.not-binding': 'Not binding here: a stricter rule wins',
  'step.plot.caption': ({ height }: { height: string }) => `The plot’s outline, extruded to the envelope’s top at ${height}.`,
  'step.setbacks.caption': ({ range }: { range: string }) => `Road and neighbour setbacks pull the walls in by ${range}.`,
  'step.height-vs-road.caption': ({ from, multiple, top }: { from: string; multiple: string; top: string }) =>
    `Above ${from} it steps back so no point is taller than ${multiple}× its distance across the road, up to ${top}.`,
  'step.high-rise.caption': ({ distance }: { distance: string }) => `A high-rise keeps ${distance} clear of every boundary and road.`,
  'step.footprint': ({ area }: Area) => `Ground ${area}`,

  'scene.loading': 'Loading the 3D view…',
  'scene.site.loading': 'Loading the surrounding buildings…',
  'scene.site.failed': 'Surrounding buildings unavailable.',
  'scene.site.retry': 'Try again',
  'scene.role': '3D view',
  'scene.describe.plot': '3D view of the plot.',
  'scene.describe.among': ({ count }: Count) => `3D view of the plot among ${plural(count, 'surrounding building', 'surrounding buildings')}.`,
  'scene.describe.envelope': ({ tiers, height }: { tiers: number; height: number }) =>
    `Allowed envelope in ${plural(tiers, 'tier', 'tiers')}, up to ${height} m.`,
  'scene.describe.design': ({ floors, height }: { floors: number; height: number }) =>
    `Design: ${plural(floors, 'floor', 'floors')}, ${height} m tall.`,
  'scene.help': 'Drag to orbit, right-drag to pan and scroll to zoom. With the view focused, the arrow keys pan and Shift with the arrow keys orbits.',
  'scene.reset': 'Reset view',
  'scene.fullscreen.enter': 'Full screen',
  'scene.fullscreen.exit': 'Exit full screen',
} satisfies EngineMessages & Record<string, Message>

export type MessageId = keyof typeof en

type Params<K extends MessageId> = (typeof en)[K] extends (params: infer P) => string ? [params: P] : []

export function t<K extends MessageId>(id: K, ...params: Params<K>): string {
  const message: Message = en[id]
  return typeof message === 'string' ? message : (message as (params: unknown) => string)(params[0])
}
