import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUserPayload } from '../auth/types/jwt-user-payload.type';
import { ReservationRequestDto } from './dto/reservation-request.dto';
import { ReservationsService } from './reservations.service';
import {
  ReservationDetailsResponse,
  ReservationValidationResponse,
} from './types/reservation-response.type';

@UseGuards(JwtAuthGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post('validate')
  async validateReservation(
    @CurrentUser() currentUser: JwtUserPayload,
    @Body() requestDto: ReservationRequestDto,
  ): Promise<ReservationValidationResponse> {
    return this.reservationsService.validateReservationForUser(
      currentUser.sub,
      requestDto,
    );
  }

  @Post()
  async createReservation(
    @CurrentUser() currentUser: JwtUserPayload,
    @Body() requestDto: ReservationRequestDto,
  ): Promise<ReservationDetailsResponse> {
    return this.reservationsService.createReservationForUser(
      currentUser.sub,
      requestDto,
    );
  }

  @Get('me')
  async getMyReservations(
    @CurrentUser() currentUser: JwtUserPayload,
  ): Promise<ReservationDetailsResponse[]> {
    return this.reservationsService.findReservationsForUser(currentUser.sub);
  }

  @Delete(':id')
  async cancelReservation(
    @CurrentUser() currentUser: JwtUserPayload,
    @Param('id') reservationId: string,
  ): Promise<ReservationDetailsResponse> {
    return this.reservationsService.cancelReservationForUser(
      currentUser.sub,
      reservationId,
    );
  }
}
