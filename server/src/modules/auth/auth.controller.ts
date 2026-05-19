import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { SocialLoginDto } from './dto/social-login.dto.js';
import { SocialLinkDto } from './dto/social-link.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from '../users/user.entity.js';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('social')
  socialLogin(@Body() dto: SocialLoginDto) {
    return this.authService.socialLogin(dto);
  }

  @Post('social/link')
  linkIdentity(@CurrentUser() user: User, @Body() dto: SocialLinkDto) {
    return this.authService.linkIdentity(user.id, dto);
  }

  @Get('identities')
  listIdentities(@CurrentUser() user: User) {
    return this.authService.listIdentities(user.id);
  }

  @Delete('identities/:provider')
  unlinkIdentity(
    @CurrentUser() user: User,
    @Param('provider') provider: string,
  ) {
    return this.authService.unlinkIdentity(user.id, provider);
  }

  @Get('me')
  getMe(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      targetLanguage: user.targetLanguage,
      nativeLanguage: user.nativeLanguage,
      subscriptionTier: user.subscriptionTier,
      learningTrack: user.learningTrack ?? null,
      dailyGoal: user.dailyGoal ?? 3,
    };
  }

  @Patch('me')
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto);
  }
}
