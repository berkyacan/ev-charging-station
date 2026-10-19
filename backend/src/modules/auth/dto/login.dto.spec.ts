import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  it('accepts a valid login payload', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'user@example.com',
      password: 'securepass',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('normalizes email to lowercase and trims whitespace', () => {
    const dto = plainToInstance(LoginDto, {
      email: '  USER@EXAMPLE.COM  ',
      password: 'securepass',
    });

    expect(dto.email).toBe('user@example.com');
  });

  it('rejects an invalid email format', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'not-an-email',
      password: 'securepass',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'user@example.com',
      password: 'short',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a password longer than 100 characters', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'user@example.com',
      password: 'a'.repeat(101),
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a missing email', async () => {
    const dto = plainToInstance(LoginDto, {
      password: 'securepass',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a missing password', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'user@example.com',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});
