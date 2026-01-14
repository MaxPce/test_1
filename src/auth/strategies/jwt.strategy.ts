import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import type { AuthUser } from '../../common/interfaces/auth-user.interface'; // ✅ import type

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {
    const secret = configService.get<string>('JWT_SECRET'); // ✅ Extraer primero

    if (!secret) {
      throw new Error('JWT_SECRET no está configurado');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret, // ✅ Usar variable con tipo garantizado
    });
  }

  async validate(payload: any): Promise<AuthUser> {
    const user = await this.usersRepository.findOne({
      where: { userId: payload.sub, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    return {
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: user.role,
    };
  }
}
