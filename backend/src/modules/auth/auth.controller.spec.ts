import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

const mockPublicUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: UserRole.EV_DRIVER,
  demoWalletBalance: 0,
  createdAt: new Date('2026-01-01'),
};

const mockAuthResponse = {
  accessToken: 'mock-token',
  user: mockPublicUser,
};

describe('AuthController', () => {
  let authController: AuthController;
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    getCurrentUserProfile: jest.Mock;
  };

  beforeEach(() => {
    authService = {
      register: jest.fn().mockResolvedValue(mockAuthResponse),
      login: jest.fn().mockResolvedValue(mockAuthResponse),
      getCurrentUserProfile: jest.fn().mockResolvedValue(mockPublicUser),
    };

    authController = new AuthController(
      authService as unknown as AuthService,
    );
  });

  describe('register', () => {
    it('delegates to authService.register and returns the result', async () => {
      const dto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };

      const result = await authController.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockAuthResponse);
    });
  });

  describe('login', () => {
    it('delegates to authService.login and returns the result', async () => {
      const dto = { email: 'test@example.com', password: 'password123' };

      const result = await authController.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockAuthResponse);
    });
  });

  describe('getMe', () => {
    it('delegates to authService.getCurrentUserProfile with the current user id', async () => {
      const payload = {
        sub: 'user-1',
        email: 'test@example.com',
        role: UserRole.EV_DRIVER,
      };

      const result = await authController.getMe(payload);

      expect(authService.getCurrentUserProfile).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockPublicUser);
    });
  });
});
