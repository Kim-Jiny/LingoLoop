import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inquiry } from './inquiry.entity.js';
import { InquiriesController } from './inquiries.controller.js';
import { InquiriesService } from './inquiries.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Inquiry])],
  controllers: [InquiriesController],
  providers: [InquiriesService],
  exports: [InquiriesService],
})
export class InquiriesModule {}
