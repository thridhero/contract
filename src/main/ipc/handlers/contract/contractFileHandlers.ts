import { contractFileAuxHandlers } from './contract-files/auxHandlers'
import { contractFileMutationHandlers } from './contract-files/mutationHandlers'
import { contractFileQueryHandlers } from './contract-files/queryHandlers'

export const contractFileHandlers = {
  ...contractFileQueryHandlers,
  ...contractFileMutationHandlers,
  ...contractFileAuxHandlers,
}
