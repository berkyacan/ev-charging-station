import {
  calculateConsumedKWh,
  calculateTotalCost,
  createChargingSessionSummary,
  validateChargingSessionInput,
} from './charging-session-summary';

describe('chargingSessionSummary', () => {
  it('returns consumed 45 and total 180 for start 15, end 60, price 4', () => {
    const result = createChargingSessionSummary(15, 60, 4);

    expect(calculateConsumedKWh(15, 60)).toBe(45);
    expect(calculateTotalCost(45, 4)).toBe(180);
    expect(result).toEqual({
      isValid: true,
      errors: [],
      summary: {
        startEnergyKWh: 15,
        endEnergyKWh: 60,
        consumedKWh: 45,
        pricePerKWh: 4,
        totalCost: 180,
      },
    });
  });

  it('rejects end energy lower than start energy', () => {
    const result = validateChargingSessionInput(60, 15, 4);

    expect(result).toEqual({
      isValid: false,
      errors: [
        expect.objectContaining({
          code: 'INVALID_ENERGY_RANGE',
        }),
      ],
    });
  });

  it('allows equal end and start values and calculates zero consumption', () => {
    const result = createChargingSessionSummary(15, 15, 4);

    expect(result).toEqual({
      isValid: true,
      errors: [],
      summary: {
        startEnergyKWh: 15,
        endEnergyKWh: 15,
        consumedKWh: 0,
        pricePerKWh: 4,
        totalCost: 0,
      },
    });
  });

  it('rejects negative start energy', () => {
    const result = validateChargingSessionInput(-1, 15, 4);

    expect(result).toEqual({
      isValid: false,
      errors: [
        expect.objectContaining({
          code: 'NEGATIVE_START_ENERGY',
        }),
      ],
    });
  });

  it('rejects zero price per kWh', () => {
    const result = validateChargingSessionInput(15, 60, 0);

    expect(result).toEqual({
      isValid: false,
      errors: [
        expect.objectContaining({
          code: 'NON_POSITIVE_PRICE_PER_KWH',
        }),
      ],
    });
  });

  it('rejects negative price per kWh', () => {
    const result = validateChargingSessionInput(15, 60, -4);

    expect(result).toEqual({
      isValid: false,
      errors: [
        expect.objectContaining({
          code: 'NON_POSITIVE_PRICE_PER_KWH',
        }),
      ],
    });
  });
});
