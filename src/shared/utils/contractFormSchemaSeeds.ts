import rawContractFormSchemaSeeds from '../../../resources/contract/contract_form_schema_seeds.json'
import type { ContractBuiltinFieldKey, ContractFormSchemaField } from '../types/contractFormSchema.types'

export type ContractTypeSeedFields = Partial<ContractFormSchemaField>[]

type ContractFormSchemaSeedConfig = {
  coreRequiredFields: ContractBuiltinFieldKey[]
  builtinFieldDefinitions: ContractFormSchemaField[]
  contractTypeSeeds: Record<string, ContractTypeSeedFields>
  contractTypeSeedAliases: Record<string, string>
}

const contractFormSchemaSeedConfig = rawContractFormSchemaSeeds as ContractFormSchemaSeedConfig

function cloneField<T extends Partial<ContractFormSchemaField>>(field: T): T {
  return {
    ...field,
    options: Array.isArray(field.options) ? [...field.options] : field.options,
    optionSource: field.optionSource ? { ...field.optionSource } : field.optionSource,
  }
}

export const CORE_REQUIRED_FIELDS = new Set<ContractBuiltinFieldKey>([
  ...contractFormSchemaSeedConfig.coreRequiredFields,
])

export const BUILTIN_FIELD_DEFINITIONS: ContractFormSchemaField[] =
  contractFormSchemaSeedConfig.builtinFieldDefinitions.map(field => cloneField(field))

export const CONTRACT_TYPE_SEEDS: Record<string, ContractTypeSeedFields> = Object.fromEntries(
  Object.entries(contractFormSchemaSeedConfig.contractTypeSeeds).map(([typeKey, fields]) => [
    typeKey,
    fields.map(field => cloneField(field)),
  ]),
)

export const CONTRACT_TYPE_SEED_ALIASES: Record<string, string> = {
  ...contractFormSchemaSeedConfig.contractTypeSeedAliases,
}
