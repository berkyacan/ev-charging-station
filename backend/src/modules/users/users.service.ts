import { Injectable } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PublicUser } from './types/public-user.type';

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}

  async createUser(data: CreateUserInput): Promise<PublicUser> {
    const user = await this.prismaService.user.create({
      data: {
        name: data.name.trim(),
        email: this.normalizeEmail(data.email),
        passwordHash: data.passwordHash,
        role: data.role,
      },
    });

    return this.toPublicUser(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.prismaService.user.findUnique({
      where: { id },
    });
  }

  async findPublicById(id: string): Promise<PublicUser | null> {
    const user = await this.findById(id);

    return user ? this.toPublicUser(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prismaService.user.findUnique({
      where: { email: this.normalizeEmail(email) },
    });
  }

  async findPublicByEmail(email: string): Promise<PublicUser | null> {
    const user = await this.findByEmail(email);

    return user ? this.toPublicUser(user) : null;
  }

  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      demoWalletBalance: Number(user.demoWalletBalance.toString()),
      createdAt: user.createdAt,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
