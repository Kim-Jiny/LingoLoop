import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ClientInfoDto } from './client-info.dto.js';

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ClientInfoDto)
  clientInfo?: ClientInfoDto;
}
