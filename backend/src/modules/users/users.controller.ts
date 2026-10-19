import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FindUserByEmailDto } from './dto/find-user-by-email.dto';
import { PublicUser } from './types/public-user.type';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  async getUserById(@Param('id') id: string): Promise<PublicUser> {
    const user = await this.usersService.findPublicById(id);

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  @Get()
  async getUserByEmail(
    @Query() query: FindUserByEmailDto,
  ): Promise<PublicUser> {
    const user = await this.usersService.findPublicByEmail(query.email);

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }
}
