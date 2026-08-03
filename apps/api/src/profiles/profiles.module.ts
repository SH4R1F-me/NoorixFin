/**
 * Profiles Module — Blueprint §9.2, §11.2
 * GET /v1/me, PATCH /v1/me/preferences
 */
import { Module } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
