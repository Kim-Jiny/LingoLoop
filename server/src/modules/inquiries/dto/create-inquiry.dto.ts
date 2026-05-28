import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateInquiryDto {
  @IsOptional()
  @IsIn(['general', 'subscription'])
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  message: string;
}
