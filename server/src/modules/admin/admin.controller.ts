import { Controller, Post } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { Public } from '../../common/decorators/public.decorator.js';

@Controller('api/admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Public()
  @Post('seed')
  seed() {
    return this.adminService.seed();
  }
}
