import { otherFileAuxHandlers } from './other-files/auxHandlers'
import { otherFileMutationHandlers } from './other-files/mutationHandlers'
import { otherFileQueryHandlers } from './other-files/queryHandlers'

export const otherFileHandlers = {
  ...otherFileQueryHandlers,
  ...otherFileMutationHandlers,
  ...otherFileAuxHandlers,
}

