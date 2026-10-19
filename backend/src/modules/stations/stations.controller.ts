import { Controller, Get, Param, Query } from '@nestjs/common';
import { StationFiltersDto } from './dto/station-filters.dto';
import { StationsService } from './stations.service';
import {
  StationChargersResponse,
  StationDetailResponse,
  StationListItemResponse,
} from './types/station-response.type';

@Controller('stations')
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Get()
  async getStations(
    @Query() filters: StationFiltersDto,
  ): Promise<StationListItemResponse[]> {
    return this.stationsService.findAll(filters);
  }

  @Get(':id/chargers')
  async getStationChargers(
    @Param('id') stationId: string,
    @Query() filters: StationFiltersDto,
  ): Promise<StationChargersResponse> {
    return this.stationsService.findChargersByStationId(stationId, filters);
  }

  @Get(':id')
  async getStationById(
    @Param('id') stationId: string,
  ): Promise<StationDetailResponse> {
    return this.stationsService.findById(stationId);
  }
}
