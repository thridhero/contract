import type { RouteLocationRaw } from 'vue-router'
import {
  getUnitLibraryPartyMeta,
  isUnitLibraryPartyType,
  sanitizeUnitLibraryFolderName,
  type UnitLibraryPartyMeta,
  type UnitLibraryPartyType,
} from '../../../../shared/utils/unitLibrary'

export const UNIT_LIBRARY_ROUTE_NAME = 'UnitLibrary'
export {
  getUnitLibraryPartyMeta,
  isUnitLibraryPartyType,
  sanitizeUnitLibraryFolderName,
  type UnitLibraryPartyMeta,
  type UnitLibraryPartyType,
}

export const buildUnitLibraryRouteLocation = (
  partyType: UnitLibraryPartyType,
  unitId: string,
): RouteLocationRaw => ({
  name: UNIT_LIBRARY_ROUTE_NAME,
  params: {
    partyType,
    unitId,
  },
})
