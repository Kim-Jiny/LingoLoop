import { IsNotEmpty, IsObject } from 'class-validator';

export class SubmitAnswerDto {
  @IsNotEmpty()
  @IsObject()
  answer: Record<string, any>;
}
