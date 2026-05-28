import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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

  @Delete('me')
  async deleteMe(@CurrentUser() user: User, @Query('force') force?: string) {
    // Apple/Play don't auto-cancel an active store subscription when
    // the in-app account is deleted — the user keeps getting charged
    // until they cancel it via iOS Settings → Subscriptions or the
    // Play Store. We can't cancel from the server either. So when
    // the user still has a paid plan, refuse the delete and tell
    // them to cancel first; the client then re-posts with ?force=1
    // after showing them the warning.
    if (force !== '1' && user.subscriptionTier === 'premium') {
      throw new ConflictException({
        code: 'active_subscription',
        message:
          '아직 결제 중인 프리미엄 구독이 있어요. iOS 설정 → Apple ID → 구독 (또는 Play 스토어 → 정기결제)에서 먼저 취소해 주세요. 그래도 탈퇴하시려면 다시 시도해 주세요.',
      });
    }
    await this.authService.deleteSelf(user.id);
    return { deleted: true };
  }
}
