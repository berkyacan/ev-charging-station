import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WalletTopUpDto } from './wallet-top-up.dto';

describe('WalletTopUpDto', () => {
  it('accepts a valid positive amount', async () => {
    const dto = plainToInstance(WalletTopUpDto, { amount: 50 });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts the minimum allowed amount of 1', async () => {
    const dto = plainToInstance(WalletTopUpDto, { amount: 1 });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts a decimal amount', async () => {
    const dto = plainToInstance(WalletTopUpDto, { amount: 9.99 });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects an amount below the minimum (0)', async () => {
    const dto = plainToInstance(WalletTopUpDto, { amount: 0 });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  it('rejects a negative amount', async () => {
    const dto = plainToInstance(WalletTopUpDto, { amount: -10 });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  it('rejects a string value for amount', async () => {
    const dto = plainToInstance(WalletTopUpDto, { amount: 'fifty' });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  it('rejects a missing amount', async () => {
    const dto = plainToInstance(WalletTopUpDto, {});

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });
});
