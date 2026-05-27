import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private usersService: UsersService,
  ) {
    // JWT_ACCESS_SECRET 누락 시 절대 fallback 사용 금지. 이전엔
    // 'fallback-secret' 기본값을 둬서, 환경변수 누락된 production에서
    // 누구나 'fallback-secret'으로 user.id를 임의 서명해 그 사용자
    // 흉내가 가능했음 (sign은 throw, verify는 통과로 비대칭 위험).
    // 부팅 시점에 hard-fail로 잘못된 배포를 즉시 감지.
    const secret = configService.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new InternalServerErrorException(
        'JWT_ACCESS_SECRET must be set — refusing to start with a forgeable token verifier.',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
