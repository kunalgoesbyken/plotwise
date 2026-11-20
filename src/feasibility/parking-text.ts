import type { Bound, Cite, ParkingDemand, Range } from '@/rules'
import { formatComparator, formatList, formatQuantity } from '@/text/format'
import { t } from '@/text/messages'

const sqm = (value: number) => formatQuantity(value, 'sqm')

const bound = ({ cmp, value }: Bound) => `${formatComparator(cmp)} ${sqm(value)}`

function sizeText({ min, max }: Range): string {
  if (min && max) return t('range.between', { min: bound(min), max: bound(max) })
  const only = min ?? max
  return only ? bound(only) : t('range.any')
}

type RoomTier = Extract<ParkingDemand, { kind: 'perRoomTiers' }>['tiers'][number]

const roomTier = ({ uptoRooms, roomsPerSpace }: RoomTier) =>
  uptoRooms
    ? t('parking.room-tier', { rooms: roomsPerSpace.value, upto: uptoRooms.value })
    : t('parking.room-tier-beyond', { rooms: roomsPerSpace.value })

export function demandText(demand: ParkingDemand): string {
  switch (demand.kind) {
    case 'perUnit':
      return t('parking.per-unit', {
        spaces: demand.spacesPerUnit.value,
        unit: `${formatComparator(demand.unitsFromSqm.cmp)} ${sqm(demand.unitsFromSqm.value)}`,
      })
    case 'perUnitBySize':
      return t('parking.per-unit-by-size', {
        bands: formatList(demand.bands.map((band) => t('parking.unit-band', { size: sizeText(band.unitSqm), spaces: band.spacesPerUnit.value }))),
      })
    case 'perGrossArea':
      return t('parking.per-gross-area', { area: sqm(demand.sqmPerSpace.value) })
    case 'perFloorArea':
      return t('parking.per-floor-area', {
        area: sqm(demand.sqmPerSpace.value),
        from: `${formatComparator(demand.appliesFromSqm.cmp)} ${sqm(demand.appliesFromSqm.value)}`,
      })
    case 'perRoomTiers':
      return t('parking.per-room-tiers', {
        spaces: demand.firstSpaces.value,
        rooms: demand.firstRooms.value,
        then: formatList(demand.tiers.map(roomTier)),
      })
    case 'perLobbyAndCommercialArea':
      return t('parking.per-lobby', { lobby: sqm(demand.lobbySqmPerSpace.value), shops: sqm(demand.commercialSqmPerSpace.value) })
  }
}

export function demandCites(demand: ParkingDemand): Cite[] {
  switch (demand.kind) {
    case 'perUnit':
      return [demand.spacesPerUnit.cite, demand.unitsFromSqm.cite]
    case 'perUnitBySize':
      return demand.bands.map((band) => band.spacesPerUnit.cite)
    case 'perGrossArea':
      return [demand.sqmPerSpace.cite]
    case 'perFloorArea':
      return [demand.sqmPerSpace.cite, demand.appliesFromSqm.cite]
    case 'perRoomTiers':
      return [demand.firstSpaces.cite, ...demand.tiers.map((tier) => tier.roomsPerSpace.cite)]
    case 'perLobbyAndCommercialArea':
      return [demand.lobbySqmPerSpace.cite, demand.commercialSqmPerSpace.cite, demand.appliesFromSqm.cite]
  }
}
