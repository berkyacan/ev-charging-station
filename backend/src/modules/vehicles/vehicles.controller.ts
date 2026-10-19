import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtUserPayload } from '../auth/types/jwt-user-payload.type';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehicleResponse, VehiclesService } from './vehicles.service';

@UseGuards(JwtAuthGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  async createVehicle(
    @CurrentUser() currentUser: JwtUserPayload,
    @Body() createVehicleDto: CreateVehicleDto,
  ): Promise<VehicleResponse> {
    return this.vehiclesService.createForUser(currentUser.sub, createVehicleDto);
  }

  @Get('me')
  async getMyVehicles(
    @CurrentUser() currentUser: JwtUserPayload,
  ): Promise<VehicleResponse[]> {
    return this.vehiclesService.findAllForUser(currentUser.sub);
  }

  @Get(':id')
  async getVehicleById(
    @CurrentUser() currentUser: JwtUserPayload,
    @Param('id') vehicleId: string,
  ): Promise<VehicleResponse> {
    return this.vehiclesService.findByIdForUser(currentUser.sub, vehicleId);
  }
}
