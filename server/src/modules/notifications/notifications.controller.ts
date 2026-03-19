import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { RegisterTokenDto } from './dto/register-token.dto.js';
import { UpdateNotificationSettingsDto } from './dto/update-settings.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from '../users/user.entity.js';

@Controller('api/notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post('token')
  registerToken(@CurrentUser() user: User, @Body() dto: RegisterTokenDto) {
    return this.notificationsService.registerToken(user.id, dto);
  }

  @Delete('token/:token')
  removeToken(@CurrentUser() user: User, @Param('token') token: string) {
    return this.notificationsService.removeToken(user.id, token);
  }

  @Get('settings')
  getSettings(@CurrentUser() user: User) {
    return this.notificationsService.getSettings(user.id);
  }

  @Put('settings')
  updateSettings(
    @CurrentUser() user: User,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.notificationsService.updateSettings(user.id, dto);
  }

  @Get('logs')
  getPushLogs(@CurrentUser() user: User) {
    return this.notificationsService.getPushLogs(user.id);
  }

  @Post('logs/:id/tap')
  logPushTap(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.notificationsService.logPushTap(user.id, id);
  }
}
