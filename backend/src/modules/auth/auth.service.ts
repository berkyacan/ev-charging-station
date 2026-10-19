import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DomainValidationException } from '../shared/errors/domain-validation.exception';
import { UsersService } from '../users/users.service';
import { PublicUser } from '../users/types/public-user.type';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponse } from './types/auth-response.type';
import { JwtUserPayload } from './types/jwt-user-payload.type';

const BCRYPT_SALT_ROUNDS = 10;
const DEFAULT_JWT_EXPIRES_IN = '7d';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new DomainValidationException(
        'Email is already registered.',
        'EMAIL_ALREADY_REGISTERED',
      );
    }

    const passwordHash = await bcrypt.hash(
      registerDto.password,
      BCRYPT_SALT_ROUNDS,
    );
    const user = await this.usersService.createUser({
      name: registerDto.name,
      email: registerDto.email,
      passwordHash,
      role: UserRole.EV_DRIVER,
    });

    return this.buildAuthResponse(user);
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatches = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.buildAuthResponse(this.usersService.toPublicUser(user));
  }

  async getCurrentUserProfile(userId: string): Promise<PublicUser> {
    const user = await this.usersService.findPublicById(userId);

    if (!user) {
      throw new UnauthorizedException('Authenticated user no longer exists.');
    }

    return user;
  }

  private async buildAuthResponse(user: PublicUser): Promise<AuthResponse> {
    return {
      accessToken: await this.generateAccessToken(user),
      user,
    };
  }

  private async generateAccessToken(user: PublicUser): Promise<string> {
    const payload: JwtUserPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: DEFAULT_JWT_EXPIRES_IN,
    });
  }
}
