import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FindUserByEmailDto } from './find-user-by-email.dto';

describe('FindUserByEmailDto', () => {
  it('accepts a valid email', async () => {
    const dto = plainToInstance(FindUserByEmailDto, {
      email: 'user@example.com',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('normalizes email to lowercase and trims whitespace', () => {
    const dto = plainToInstance(FindUserByEmailDto, {
      email: '  USER@EXAMPLE.COM  ',
    });

    expect(dto.email).toBe('user@example.com');
  });

  it('rejects an invalid email format', async () => {
    const dto = plainToInstance(FindUserByEmailDto, {
      email: 'not-an-email',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a missing email', async () => {
    const dto = plainToInstance(FindUserByEmailDto, {});

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });
});
