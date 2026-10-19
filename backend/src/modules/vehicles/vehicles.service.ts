import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConnectorType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

export interface VehicleResponse {
  id: string;
  userId: string;
  brand: string;
  model: string;
  batteryCapacityKWh: number;
  connectorType: ConnectorType;
  maxSupportedPowerKW: number;
  plateNumber: string;
  createdAt: string;
}

@Injectable()
export class VehiclesService {
  constructor(private readonly prismaService: PrismaService) {}

  async createForUser(
    userId: string,
    createVehicleDto: CreateVehicleDto,
  ): Promise<VehicleResponse> {
    try {
      const vehicle = await this.prismaService.vehicle.create({
        data: {
          userId,
          brand: createVehicleDto.brand,
          model: createVehicleDto.model,
          batteryCapacityKWh: createVehicleDto.batteryCapacityKWh,
          connectorType: createVehicleDto.connectorType,
          maxSupportedPowerKW: createVehicleDto.maxSupportedPowerKW,
          plateNumber: createVehicleDto.plateNumber,
        },
      });

      return this.toVehicleResponse(vehicle);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `"${createVehicleDto.plateNumber}" is already registered in your account.`,
        );
      }

      throw error;
    }
  }

  async findAllForUser(userId: string): Promise<VehicleResponse[]> {
    const vehicles = await this.prismaService.vehicle.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return vehicles.map((vehicle) => this.toVehicleResponse(vehicle));
  }

  async findByIdForUser(userId: string, vehicleId: string): Promise<VehicleResponse> {
    const vehicle = await this.prismaService.vehicle.findFirst({
      where: {
        id: vehicleId,
        userId,
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found.');
    }

    return this.toVehicleResponse(vehicle);
  }

  private toVehicleResponse(vehicle: {
    id: string;
    userId: string;
    brand: string;
    model: string;
    batteryCapacityKWh: { toString(): string };
    connectorType: ConnectorType;
    maxSupportedPowerKW: { toString(): string };
    plateNumber: string;
    createdAt: Date;
  }): VehicleResponse {
    return {
      id: vehicle.id,
      userId: vehicle.userId,
      brand: vehicle.brand,
      model: vehicle.model,
      batteryCapacityKWh: Number(vehicle.batteryCapacityKWh.toString()),
      connectorType: vehicle.connectorType,
      maxSupportedPowerKW: Number(vehicle.maxSupportedPowerKW.toString()),
      plateNumber: vehicle.plateNumber,
      createdAt: vehicle.createdAt.toISOString(),
    };
  }
}
