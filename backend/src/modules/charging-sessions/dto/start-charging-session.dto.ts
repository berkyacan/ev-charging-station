import { IsNotEmpty, IsString } from 'class-validator';

export class StartChargingSessionDto {
  @IsString()
  @IsNotEmpty()
  reservationId!: string;
}
