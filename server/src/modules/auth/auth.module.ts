import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { RefreshToken } from './refresh-token.entity.js';
import { AuthIdentity } from './auth-identity.entity.js';
import { SocialVerifierService } from './social/social-verifier.service.js';
import { AppleAuthService } from './social/apple-auth.service.js';
import { UsersModule } from '../users/users.module.js';
import { UserLanguageTrack } from '../users/user-language-track.entity.js';
import { Language } from '../sentences/language.entity.js';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([
      RefreshToken,
      AuthIdentity,
      UserLanguageTrack,
      Language,
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    SocialVerifierService,
    AppleAuthService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
