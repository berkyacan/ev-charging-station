import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DomainValidationException } from '../shared/errors/domain-validation.exception';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

const mockPublicUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: UserRole.EV_DRIVER,
  demoWalletBalance: 0,
  createdAt: new Date('2026-01-01'),
};

const mockFullUser = {
  ...mockPublicUser,
  passwordHash: 'hashed_password',
};

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: {
    findByEmail: jest.Mock;
    createUser: jest.Mock;
    findPublicById: jest.Mock;
    toPublicUser: jest.Mock;
  };
  let jwtService: {
    signAsync: jest.Mock;
  };

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      createUser: jest.fn(),
      findPublicById: jest.fn(),
      toPublicUser: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
    };

    authService = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
    );
  });

  describe('register', () => {
    it('creates a new user and returns auth response when email is not taken', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.createUser.mockResolvedValue(mockPublicUser);

      const result = await authService.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      expect(usersService.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(usersService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test User',
          email: 'test@example.com',
          role: UserRole.EV_DRIVER,
        }),
      );
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user).toEqual(mockPublicUser);
    });

    it('hashes the password before creating the user', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.createUser.mockResolvedValue(mockPublicUser);

      await authService.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      const createUserCall = usersService.createUser.mock.calls[0][0];
      const passwordHash = createUserCall.passwordHash;

      expect(passwordHash).not.toBe('password123');
      expect(await bcrypt.compare('password123', passwordHash)).toBe(true);
    });

    it('throws DomainValidationException when email is already registered', async () => {
      usersService.findByEmail.mockResolvedValue(mockFullUser);

      await expect(
        authService.register({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(DomainValidationException);

      expect(usersService.createUser).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns auth response for valid credentials', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      usersService.findByEmail.mockResolvedValue({
        ...mockFullUser,
        passwordHash,
      });
      usersService.toPublicUser.mockReturnValue(mockPublicUser);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user).toEqual(mockPublicUser);
    });

    it('throws UnauthorizedException when email does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'notfound@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password does not match', async () => {
      const passwordHash = await bcrypt.hash('correct_password', 10);
      usersService.findByEmail.mockResolvedValue({
        ...mockFullUser,
        passwordHash,
      });

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'wrong_password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getCurrentUserProfile', () => {
    it('returns the public user profile for an existing user', async () => {
      usersService.findPublicById.mockResolvedValue(mockPublicUser);

      const result = await authService.getCurrentUserProfile('user-1');

      expect(usersService.findPublicById).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockPublicUser);
    });

    it('throws UnauthorizedException when user no longer exists', async () => {
      usersService.findPublicById.mockResolvedValue(null);

      await expect(
        authService.getCurrentUserProfile('deleted-user'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
