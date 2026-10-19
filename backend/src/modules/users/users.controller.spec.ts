import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

const mockPublicUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: UserRole.EV_DRIVER,
  demoWalletBalance: 0,
  createdAt: new Date('2026-01-01'),
};

describe('UsersController', () => {
  let usersController: UsersController;
  let usersService: {
    findPublicById: jest.Mock;
    findPublicByEmail: jest.Mock;
  };

  beforeEach(() => {
    usersService = {
      findPublicById: jest.fn(),
      findPublicByEmail: jest.fn(),
    };

    usersController = new UsersController(
      usersService as unknown as UsersService,
    );
  });

  describe('getUserById', () => {
    it('returns the user when found', async () => {
      usersService.findPublicById.mockResolvedValue(mockPublicUser);

      const result = await usersController.getUserById('user-1');

      expect(usersService.findPublicById).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockPublicUser);
    });

    it('throws NotFoundException when user does not exist', async () => {
      usersService.findPublicById.mockResolvedValue(null);

      await expect(
        usersController.getUserById('nonexistent'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getUserByEmail', () => {
    it('returns the user when found by email', async () => {
      usersService.findPublicByEmail.mockResolvedValue(mockPublicUser);

      const result = await usersController.getUserByEmail({
        email: 'test@example.com',
      });

      expect(usersService.findPublicByEmail).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(result).toEqual(mockPublicUser);
    });

    it('throws NotFoundException when email does not exist', async () => {
      usersService.findPublicByEmail.mockResolvedValue(null);

      await expect(
        usersController.getUserByEmail({ email: 'missing@example.com' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
