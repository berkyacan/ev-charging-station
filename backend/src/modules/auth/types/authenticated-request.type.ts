import { Request } from 'express';
import { JwtUserPayload } from './jwt-user-payload.type';

export interface AuthenticatedRequest extends Request {
  user: JwtUserPayload;
}
