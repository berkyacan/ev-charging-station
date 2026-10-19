import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  it('accepts a valid registration payload', async () => {
    const dto = plainToInstance(RegisterDto, {
      name: 'Test User',
      email: 'user@example.com',
      password: 'securepass',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('trims whitespace from name', () => {
    const dto = plainToInstance(RegisterDto, {
      name: '  Test User  ',
      email: 'user@example.com',
      password: 'securepass',
    });

    expect(dto.name).toBe('Test User');
  });

  it('normalizes email to lowercase and trims whitespace', () => {
    const dto = plainToInstance(RegisterDto, {
      name: 'Test User',
      email: '  USER@EXAMPLE.COM  ',
      password: 'securepass',
    });

    expect(dto.email).toBe('user@example.com');
  });

  it('rejects a name shorter than 2 characters', async () => {
    const dto = plainToInstance(RegisterDto, {
      name: 'A',
      email: 'user@example.com',
      password: 'securepass',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a name longer than 100 characters', async () => {
    const dto = plainToInstance(RegisterDto, {
      name: 'A'.repeat(101),
      email: 'user@example.com',
      password: 'securepass',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects an invalid email format', async () => {
    const dto = plainToInstance(RegisterDto, {
      name: 'Test User',
      email: 'not-an-email',
      password: 'securepass',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const dto = plainToInstance(RegisterDto, {
      name: 'Test User',
      email: 'user@example.com',
      password: 'short',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a password longer than 100 characters', async () => {
    const dto = plainToInstance(RegisterDto, {
      name: 'Test User',
      email: 'user@example.com',
      password: 'a'.repeat(101),
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a missing name', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'user@example.com',
      password: 'securepass',
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });
});
