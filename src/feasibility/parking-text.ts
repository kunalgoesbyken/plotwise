import type { Cite, ParkingDemand } from '@/rules'
import { formatComparator, formatList, formatQuantity, formatRange } from '@/text/format'
import { t } from '@/text/messages'
import type { AreaUnit } from '@/units/area'

type RoomTier = Extract<ParkingDemand, { kind: 'perRoomTiers' }>['tiers'][number]

const roomTier = ({ uptoRooms, roomsPerSpace }: RoomTier) =>
  uptoRooms
    ? t('parking.room-tier', { rooms: roomsPerSpace.value, upto: uptoRooms.value })
    : t('parking.room-tier-beyond', { rooms: roomsPerSpace.value })

export function demandText(demand: ParkingDemand, area: AreaUnit): string {
  const sqm = (value: number) => formatQuantity(value, area)
  switch (demand.kind) {
    case 'perUnit':
      if (demand.unitsFromSqm.value === 0) return t('parking.per-home', { spaces: demand.spacesPerUnit.value })
      return t('parking.per-unit', {
        spaces: demand.spacesPerUnit.value,
        unit: `${formatComparator(demand.unitsFromSqm.cmp)} ${sqm(demand.unitsFromSqm.value)}`,
      })
    case 'perUnitBySize':
      return t('parking.per-unit-by-size', {
        bands: formatList(demand.bands.map((band) => t('parking.unit-band', { size: formatRange(band.unitSqm, area), spaces: band.spacesPerUnit.value }))),
      })
    case 'unitsPerSpaceBySize':
      return t('parking.units-per-space-by-size', {
        bands: formatList(demand.bands.map((band) => t('parking.units-band', { size: formatRange(band.unitSqm, area), units: band.unitsPerSpace.value }))),
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
    case 'unitsPerSpaceBySize':
      return demand.bands.map((band) => band.unitsPerSpace.cite)
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
