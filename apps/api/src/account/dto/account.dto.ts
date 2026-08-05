/**
 * Account lifecycle DTOs — DEC-017
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class RequestDeletionDto {
  @ApiProperty({
    description:
      "Must exactly equal the signed-in account's email address. A typed " +
      'confirmation, so an accidental or CSRF-driven POST cannot schedule the ' +
      'deletion of an entire ledger.',
    example: 'me@example.com',
  })
  @IsEmail()
  @Length(3, 320)
  confirm_email!: string;

  @ApiProperty({
    description: 'Optional free-text reason, retained on the audit event.',
    required: false,
    example: 'No longer needed',
  })
  @IsString()
  @Length(0, 500)
  reason: string = '';
}
