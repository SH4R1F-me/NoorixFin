import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({ minLength: 2, maxLength: 100, example: 'groceries' })
  @IsString()
  @Length(2, 100)
  q!: string;
}
