import { ZoneSnapshotSchema } from '../snapshot'
import { ZONE_SOURCES } from '../sources'

export const COMMITTED_SNAPSHOT = ZoneSnapshotSchema.parse(await Bun.file(`${import.meta.dir}/../../../public${ZONE_SOURCES.bkk.snapshot}`).json())
