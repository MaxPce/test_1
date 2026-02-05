import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersRepository.findOne({
      where: [{ username: registerDto.username }, { email: registerDto.email }],
    });

    if (existingUser) {
      if (existingUser.username === registerDto.username) {
        throw new ConflictException('El username ya está en uso');
      }
      if (existingUser.email === registerDto.email) {
        throw new ConflictException('El email ya está registrado');
      }
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Crear usuario
    const user = this.usersRepository.create({
      username: registerDto.username,
      password: hashedPassword,
      fullName: registerDto.fullName,
      email: registerDto.email,
      role: registerDto.role || UserRole.VIEWER,
    });

    await this.usersRepository.save(user);

    const { password, ...result } = user;
    return {
      message: 'Usuario registrado exitosamente',
      user: result,
    };
  }

  async login(loginDto: LoginDto) {
    // Buscar usuario con password
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.username = :username', { username: loginDto.username })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Generar token
    const payload = {
      sub: user.userId,
      username: user.username,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: '24h',
      user: {
        userId: user.userId,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    };
  }

  async validateUser(userId: number): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { userId, isActive: true },
    });
  }

  async getProfile(userId: number) {
    const user = await this.usersRepository.findOne({
      where: { userId },
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    const { password, ...result } = user;
    return result;
  }
}
