import { Injectable } from '@nestjs/common';

export interface HealthResponse {
  service: 'ev-charging-backend';
  status: 'ok';
  timestamp: string;
}

@Injectable()
export class AppService {
  getHealth(): HealthResponse {
    return {
      service: 'ev-charging-backend',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
