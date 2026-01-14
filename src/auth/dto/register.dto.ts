import {
  IsString,
  IsEmail,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';

export class RegisterDto {
  @IsString()
  @MinLength(4, { message: 'El username debe tener al menos 4 caracteres' })
  @MaxLength(100)
  username: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @IsString()
  @MaxLength(200)
  fullName: string;

  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
