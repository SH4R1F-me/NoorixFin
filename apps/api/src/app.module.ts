/**
 * NoorixFin API — Root Application Module
 * Blueprint §7.1: Modular monolith structure
 *
 * Wires together all domain modules, global guards, filters, and middleware.
 */
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

// Infrastructure modules
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { SyncModule } from './sync/sync.module';
import { ObservabilityModule } from './observability/observability.module';
import { SupabaseAuthGuard } from './auth/guards/supabase-auth.guard';

// Domain modules
import { HealthModule } from './health/health.module';
import { ProfilesModule } from './profiles/profiles.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { AccountsModule } from './accounts/accounts.module';
import { TransactionsModule } from './transactions/transactions.module';
import { CategoriesModule } from './categories/categories.module';
import { PlanningModule } from './planning/planning.module';
import { AdminModule } from './admin/admin.module';
import { AccountModule } from './account/account.module';

// Middleware, Filters & Interceptors
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestTelemetryInterceptor } from './common/interceptors/logging.interceptor';
import { IdentityThrottlerGuard } from './common/guards/identity-throttler.guard';

@Module({
  imports: [
    // ─── Configuration ──────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // ─── Rate Limiting (Blueprint §16.2) ────────────────
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 10, // 10 requests per second
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
      {
        name: 'long',
        ttl: 3600000, // 1 hour
        limit: 1000, // 1000 requests per hour
      },
    ]),

    // ─── Infrastructure ─────────────────────────────────
    SupabaseModule,
    AuthModule,
    SyncModule,
    ObservabilityModule,

    // ─── Domain Modules ─────────────────────────────────
    HealthModule,
    ProfilesModule,
    WorkspacesModule,
    AccountsModule,
    TransactionsModule,
    CategoriesModule,
    // Budgets, goals, debts, calendar and recurring rules (§9.4). Ships as one
    // module because they are one product surface — see planning.module.ts.
    PlanningModule,

    // ─── Platform / Admin (DEC-016, DEC-017) ────────────
    AdminModule,
    AccountModule,
  ],
  providers: [
    // Global auth guard (skip with @Public())
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard,
    },
    // Global rate limiting, keyed on the authenticated user rather than the
    // IP — see identity-throttler.guard.ts for why the default breaks the
    // tight tiers introduced by audit item 14.
    {
      provide: APP_GUARD,
      useClass: IdentityThrottlerGuard,
    },
    // Global exception filter — also feeds system_events (DEC-018)
    {
      provide: APP_FILTER,
      useClass: GlobalHttpExceptionFilter,
    },
    // Request telemetry — slow-request detection for the monitoring feed
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestTelemetryInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
