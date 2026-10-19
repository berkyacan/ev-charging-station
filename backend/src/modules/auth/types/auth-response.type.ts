import { PublicUser } from '../../users/types/public-user.type';

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}
