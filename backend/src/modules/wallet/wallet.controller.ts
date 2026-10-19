import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUserPayload } from '../auth/types/jwt-user-payload.type';
import { WalletTopUpDto } from './dto/wallet-top-up.dto';
import { WalletService } from './wallet.service';
import {
  WalletSummaryResponse,
  WalletTopUpResponse,
} from './types/wallet-response.type';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('me')
  async getWalletSummary(
    @CurrentUser() currentUser: JwtUserPayload,
  ): Promise<WalletSummaryResponse> {
    return this.walletService.getWalletSummaryForUser(currentUser.sub);
  }

  @Post('top-up')
  async topUpWallet(
    @CurrentUser() currentUser: JwtUserPayload,
    @Body() dto: WalletTopUpDto,
  ): Promise<WalletTopUpResponse> {
    return this.walletService.topUpWalletForUser(currentUser.sub, dto);
  }
}
