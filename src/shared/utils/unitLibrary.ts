export type UnitLibraryPartyType = 'party-a' | 'party-b';

export interface UnitLibraryPartyMeta {
  partyType: UnitLibraryPartyType;
  rootDirName: string;
  pageTitle: string;
  unitLabel: string;
  detailActionLabel: string;
}

export const sanitizeUnitLibraryFolderName = (value: string): string => {
  const sanitized = String(value || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim();

  return sanitized || '未命名单位';
};

const UNIT_LIBRARY_PARTY_META_MAP: Record<UnitLibraryPartyType, UnitLibraryPartyMeta> = {
  'party-a': {
    partyType: 'party-a',
    rootDirName: '甲方单位资料库',
    pageTitle: '甲方单位资料库',
    unitLabel: '甲方单位',
    detailActionLabel: '进入甲方资料库',
  },
  'party-b': {
    partyType: 'party-b',
    rootDirName: '乙方单位资料库',
    pageTitle: '乙方单位资料库',
    unitLabel: '乙方单位',
    detailActionLabel: '进入乙方资料库',
  },
};

export const isUnitLibraryPartyType = (value: unknown): value is UnitLibraryPartyType =>
  value === 'party-a' || value === 'party-b';

export const getUnitLibraryPartyMeta = (partyType: UnitLibraryPartyType): UnitLibraryPartyMeta =>
  UNIT_LIBRARY_PARTY_META_MAP[partyType];
