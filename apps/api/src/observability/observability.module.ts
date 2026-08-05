/**
 * Observability Module — DEC-018
 *
 * Global so the exception filter, the logging interceptor, and every domain
 * service can record without each module importing it. SupabaseModule is already
 * @Global, so this has no imports of its own.
 */
import { Global, Module } from '@nestjs/common';
import { SystemEventsService } from './system-events.service';
import { AuditService } from './audit.service';
import { TracingService } from './tracing.service';

@Global()
@Module({
  providers: [SystemEventsService, AuditService, TracingService],
  exports: [SystemEventsService, AuditService, TracingService],
})
export class ObservabilityModule {}
