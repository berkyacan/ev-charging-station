import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateVehicleDto } from './create-vehicle.dto';

describe('CreateVehicleDto', () => {
  it('accepts a valid vehicle payload', async () => {
    const dto = plainToInstance(CreateVehicleDto, {
      brand: 'Tesla',
      model: 'Model 3',
      batteryCapacityKWh: 75,
      connectorType: 'CCS',
      maxSupportedPowerKW: 50,
      plateNumber: '35 EV 2024',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid connector type', async () => {
    const dto = plainToInstance(CreateVehicleDto, {
      brand: 'Tesla',
      model: 'Model 3',
      batteryCapacityKWh: 75,
      connectorType: 'INVALID',
      maxSupportedPowerKW: 50,
      plateNumber: '35 EV 2024',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'connectorType')).toBe(
      true,
    );
  });

  it('rejects a battery capacity above the supported range', async () => {
    const dto = plainToInstance(CreateVehicleDto, {
      brand: 'Tesla',
      model: 'Model 3',
      batteryCapacityKWh: 7599,
      connectorType: 'CCS',
      maxSupportedPowerKW: 50,
      plateNumber: '35 EV 2024',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'batteryCapacityKWh')).toBe(
      true,
    );
  });

  it('rejects a max supported power above the supported range', async () => {
    const dto = plainToInstance(CreateVehicleDto, {
      brand: 'Tesla',
      model: 'Model 3',
      batteryCapacityKWh: 75,
      connectorType: 'CCS',
      maxSupportedPowerKW: 9999,
      plateNumber: '35 EV 2024',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'maxSupportedPowerKW')).toBe(
      true,
    );
  });

  it('rejects a missing plate number', async () => {
    const dto = plainToInstance(CreateVehicleDto, {
      brand: 'Tesla',
      model: 'Model 3',
      batteryCapacityKWh: 75,
      connectorType: 'CCS',
      maxSupportedPowerKW: 50,
      plateNumber: '',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'plateNumber')).toBe(
      true,
    );
  });
});
