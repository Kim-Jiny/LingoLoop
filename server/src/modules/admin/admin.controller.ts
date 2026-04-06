import { Body, Controller, Get, Header, Post, Put } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { UpdateAppConfigDto } from './dto/update-app-config.dto.js';

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

  @Public()
  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboardData();
  }

  @Public()
  @Put('app-config')
  updateAppConfig(@Body() dto: UpdateAppConfigDto) {
    return this.adminService.updateAppConfig(dto);
  }
}
