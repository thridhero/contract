export type FixedCategoryId = 'all' | 'uncategorized' | 'common';

export interface TagGroupEntity {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TagEntity {
  id: string;
  name: string;
  initial: string;
  initial_letter: string;
  is_common: number;
  group_id: string | null;
  use_count: number;
  created_at: string;
  updated_at: string;
}

export interface TagGroupViewModel {
  id: string;
  name: string;
  count: number;
}

export interface TagViewModel {
  id: string;
  name: string;
  count: number;
  groupId: string | null;
  isCommon: boolean;
  initialLetter: string;
}

export interface DefaultTagSeed {
  name: string;
  initial: string;
  isCommon: number;
}
