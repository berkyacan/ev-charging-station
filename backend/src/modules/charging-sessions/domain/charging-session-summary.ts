import {
  ChargingSessionSummary,
  ChargingSessionSummaryResult,
  ChargingSessionValidationError,
  ChargingSessionValidationResult,
} from './charging-session-summary.types';

export function calculateConsumedKWh(
  startEnergyKWh: number,
  endEnergyKWh: number,
): number {
  return roundToTwoDecimals(endEnergyKWh - startEnergyKWh);
}

export function calculateTotalCost(
  consumedKWh: number,
  pricePerKWh: number,
): number {
  return roundToTwoDecimals(consumedKWh * pricePerKWh);
}

export function validateChargingSessionInput(
  startEnergyKWh: number,
  endEnergyKWh: number,
  pricePerKWh: number,
): ChargingSessionValidationResult {
  const errors: ChargingSessionValidationError[] = [];

  if (startEnergyKWh < 0) {
    errors.push({
      code: 'NEGATIVE_START_ENERGY',
      message: 'Start energy cannot be negative.',
      field: 'startEnergyKWh',
      details: {
        startEnergyKWh,
      },
    });
  }

  if (endEnergyKWh < startEnergyKWh) {
    errors.push({
      code: 'INVALID_ENERGY_RANGE',
      message: 'End energy cannot be lower than start energy.',
      field: 'endEnergyKWh',
      details: {
        startEnergyKWh,
        endEnergyKWh,
      },
    });
  }

  if (pricePerKWh <= 0) {
    errors.push({
      code: 'NON_POSITIVE_PRICE_PER_KWH',
      message: 'Price per kWh must be greater than zero.',
      field: 'pricePerKWh',
      details: {
        pricePerKWh,
      },
    });
  }

  if (errors.length === 0) {
    return {
      isValid: true,
      errors: [],
    };
  }

  return {
    isValid: false,
    errors,
  };
}

export function createChargingSessionSummary(
  startEnergyKWh: number,
  endEnergyKWh: number,
  pricePerKWh: number,
): ChargingSessionSummaryResult {
  const validationResult = validateChargingSessionInput(
    startEnergyKWh,
    endEnergyKWh,
    pricePerKWh,
  );

  if (!validationResult.isValid) {
    return {
      isValid: false,
      errors: validationResult.errors,
      summary: null,
    };
  }

  const consumedKWh = calculateConsumedKWh(startEnergyKWh, endEnergyKWh);
  const totalCost = calculateTotalCost(consumedKWh, pricePerKWh);
  const summary: ChargingSessionSummary = {
    startEnergyKWh,
    endEnergyKWh,
    consumedKWh,
    pricePerKWh,
    totalCost,
  };

  return {
    isValid: true,
    errors: [],
    summary,
  };
}

function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
