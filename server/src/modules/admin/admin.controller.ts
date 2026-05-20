import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { UpdateAppConfigDto } from './dto/update-app-config.dto.js';
import { AdminSessionGuard } from './admin-session.guard.js';

@Controller('api/admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Public()
  @Post('seed')
  seed() {
    return this.adminService.seed();
  }

  @Public()
  @Get('app-config/public')
  getPublicAppConfig() {
    return this.adminService.getPublicAppConfig();
  }

  @Public()
  @Get('page')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async getAdminPage() {
    return this.adminService.renderAdminPage();
  }

  @Public()
  @Get('app-config')
  getAppConfig() {
    return this.adminService.getAppConfig();
  }

  // Dashboard data feeds the /backstage page. @Public() bypasses the
  // global JWT guard; AdminSessionGuard then enforces the admin cookie.
  @Public()
  @UseGuards(AdminSessionGuard)
  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboardData();
  }

  @Public()
  @UseGuards(AdminSessionGuard)
  @Put('app-config')
  updateAppConfig(@Body() dto: UpdateAppConfigDto) {
    return this.adminService.updateAppConfig(dto);
  }
}
