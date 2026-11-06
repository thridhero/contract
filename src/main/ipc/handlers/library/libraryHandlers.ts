import { libraryContractMutationHandlers } from './library/contractMutationHandlers';
import { libraryContractReadHandlers } from './library/contractReadHandlers';
import { libraryCalendarEventHandlers } from './library/calendarEventHandlers';
import { libraryGeneralHandlers } from './library/generalHandlers';
import { libraryProjectHandlers } from './library/projectHandlers';
import { uiFolderColorsHandlers } from './library/uiFolderColorsHandlers';

export const libraryHandlers = {
  ...libraryGeneralHandlers,
  ...libraryProjectHandlers,
  ...libraryContractReadHandlers,
  ...libraryContractMutationHandlers,
  ...libraryCalendarEventHandlers,
  ...uiFolderColorsHandlers,
};
