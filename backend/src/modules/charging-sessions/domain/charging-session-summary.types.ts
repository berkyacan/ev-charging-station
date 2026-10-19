export type ChargingSessionValidationErrorCode =
  | 'INVALID_ENERGY_RANGE'
  | 'NEGATIVE_START_ENERGY'
  | 'NON_POSITIVE_PRICE_PER_KWH';

export interface ChargingSessionValidationError {
  code: ChargingSessionValidationErrorCode;
  message: string;
  field: string;
  details?: Record<string, unknown>;
}

export type ChargingSessionValidationResult =
  | {
      isValid: true;
      errors: [];
    }
  | {
      isValid: false;
      errors: ChargingSessionValidationError[];
    };

export interface ChargingSessionSummary {
  startEnergyKWh: number;
  endEnergyKWh: number;
  consumedKWh: number;
  pricePerKWh: number;
  totalCost: number;
}

export type ChargingSessionSummaryResult =
  | {
      isValid: true;
      errors: [];
      summary: ChargingSessionSummary;
    }
  | {
      isValid: false;
      errors: ChargingSessionValidationError[];
      summary: null;
    };
