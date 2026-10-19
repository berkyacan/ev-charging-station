import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from './users.service';

const mockUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  passwordHash: 'hashed_password',
  role: UserRole.EV_DRIVER,
  demoWalletBalance: { toString: () => '100.50' },
  createdAt: new Date('2026-01-01'),
};

describe('UsersService', () => {
  let usersService: UsersService;
  let prismaService: {
    user: {
      create: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaService = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    usersService = new UsersService(
      prismaService as unknown as PrismaService,
    );
  });

  describe('createUser', () => {
    it('creates a user with trimmed name and normalized email', async () => {
      prismaService.user.create.mockResolvedValue(mockUser);

      await usersService.createUser({
        name: '  Test User  ',
        email: 'TEST@EXAMPLE.COM',
        passwordHash: 'hashed_password',
        role: UserRole.EV_DRIVER,
      });

      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          name: 'Test User',
          email: 'test@example.com',
          passwordHash: 'hashed_password',
          role: UserRole.EV_DRIVER,
        },
      });
    });

    it('returns a PublicUser (without passwordHash)', async () => {
      prismaService.user.create.mockResolvedValue(mockUser);

      const result = await usersService.createUser({
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        role: UserRole.EV_DRIVER,
      });

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@example.com');
    });
  });

  describe('findById', () => {
    it('returns the user when found', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await usersService.findById('user-1');

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(result).toEqual(mockUser);
    });

    it('returns null when user is not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await usersService.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findPublicById', () => {
    it('returns a PublicUser when found', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await usersService.findPublicById('user-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('user-1');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('returns null when user is not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await usersService.findPublicById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('queries with a normalized email', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      await usersService.findByEmail('  TEST@EXAMPLE.COM  ');

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('returns null when email does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await usersService.findByEmail('missing@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findPublicByEmail', () => {
    it('returns a PublicUser when email exists', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await usersService.findPublicByEmail('test@example.com');

      expect(result).not.toBeNull();
      expect(result!.email).toBe('test@example.com');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('returns null when email does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await usersService.findPublicByEmail('missing@example.com');

      expect(result).toBeNull();
    });
  });

  describe('toPublicUser', () => {
    it('converts demoWalletBalance Decimal to a number', () => {
      const result = usersService.toPublicUser(mockUser as any);

      expect(typeof result.demoWalletBalance).toBe('number');
      expect(result.demoWalletBalance).toBe(100.5);
    });

    it('omits passwordHash from the result', () => {
      const result = usersService.toPublicUser(mockUser as any);

      expect(result).not.toHaveProperty('passwordHash');
    });

    it('maps all expected public fields', () => {
      const result = usersService.toPublicUser(mockUser as any);

      expect(result).toMatchObject({
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        role: UserRole.EV_DRIVER,
      });
    });
  });
});
