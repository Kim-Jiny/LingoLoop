import { IsString, IsOptional } from 'class-validator';

export class RegisterTokenDto {
  @IsString()
  token: string;

  @IsString()
  @IsOptional()
  platform?: string; // 'ios' | 'android'
}
