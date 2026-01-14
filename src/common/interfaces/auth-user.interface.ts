import { UserRole } from '../enums/user-role.enum';

export interface AuthUser {
  userId: number;
  username: string;
  email: string;
  role: UserRole;
}
