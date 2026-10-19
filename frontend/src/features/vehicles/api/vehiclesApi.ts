import { apiClient } from '../../shared/api';
import type { ConnectorType, Vehicle } from '../../shared/types';

export interface CreateVehicleRequest {
  brand: string;
  model: string;
  batteryCapacityKWh: number;
  connectorType: ConnectorType;
  maxSupportedPowerKW: number;
  plateNumber: string;
}

export function createVehicle(payload: CreateVehicleRequest): Promise<Vehicle> {
  return apiClient.post<Vehicle>('/vehicles', payload);
}

export function getMyVehicles(): Promise<Vehicle[]> {
  return apiClient.get<Vehicle[]>('/vehicles/me');
}
