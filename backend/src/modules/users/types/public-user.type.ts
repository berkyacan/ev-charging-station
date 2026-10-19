import { UserRole } from '@prisma/client';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  demoWalletBalance: number;
  createdAt: Date;
}
