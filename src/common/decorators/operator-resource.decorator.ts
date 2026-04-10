import { SetMetadata } from '@nestjs/common';

export interface OperatorResourceConfig {
  eventParam?: string;   
  sportParam?: string;   
}

export const OPERATOR_RESOURCE_KEY = 'operator_resource';

export const OperatorResource = (config: OperatorResourceConfig) =>
  SetMetadata(OPERATOR_RESOURCE_KEY, config);