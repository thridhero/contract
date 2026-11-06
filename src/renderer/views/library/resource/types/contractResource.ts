export interface ContractResource {
  id: number | string
  name: string
  type: string
  size: string
  date: string
  path: string
  thumbnail?: string
  tags?: string[]
  description?: string
  projectIcon?: string | null
  projectColor?: string | null
  folderName?: string
  trashPath?: string | null
  deletedAt?: string | null
  version?: string
  endDate?: string
  completionDate?: string
  softwareCategory?: string
  copyrightOwner?: string
  partyBName?: string
  technicalFeatures?: string
  contractCode?: string
  contractName?: string
  contractType?: string
  clientName?: string
  signingDate?: string
  contractSummary?: string
  contractAmount?: number | null
  currency?: string | null
  contractStatus?: string
  contractStatusDisplay?: string
  createdAt?: string
  updatedAt?: string
}
