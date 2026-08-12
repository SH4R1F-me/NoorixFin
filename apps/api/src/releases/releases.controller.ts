import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { ReleasesService } from './releases.service';

@ApiTags('Releases')
@Controller('releases')
export class ReleasesController {
  constructor(private readonly releases: ReleasesService) {}

  @Get('mobile')
  @Public()
  @Header(
    'Cache-Control',
    'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
  )
  @ApiOperation({
    summary: 'Public mobile download metadata and supported-version floor',
  })
  @ApiOkResponse({
    description: 'Current iOS, Android and APK release metadata',
  })
  mobile() {
    return this.releases.getMobileRelease();
  }
}
