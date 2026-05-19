import { IsIn, IsString } from 'class-validator';

export class UpdateVocabularyDto {
  @IsString()
  @IsIn(['learning', 'learned'])
  status: 'learning' | 'learned';
}
