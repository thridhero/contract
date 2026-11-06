import { createLogger } from '../../../utils/logger';

export const logger = createLogger('AIService');

export type ContractTypeCandidateEntry = {
  code: string;
  name: string;
};
