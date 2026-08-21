import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminUsersStatsResponseDto {
  @ApiProperty() total!: number;
  @ApiProperty() active!: number;
  @ApiProperty() suspended!: number;
  @ApiProperty() pending_deletion!: number;
  @ApiProperty() super_admins!: number;
  @ApiProperty() new_24h!: number;
  @ApiProperty() new_7d!: number;
  @ApiProperty() active_7d!: number;
}
export class AdminWorkspaceStatsResponseDto {
  @ApiProperty() total!: number;
  @ApiProperty() active!: number;
}
export class AdminLedgerStatsResponseDto {
  @ApiProperty() accounts!: number;
  @ApiProperty() entries!: number;
  @ApiProperty() entries_24h!: number;
}
export class AdminEventStatsResponseDto {
  @ApiProperty() total!: number;
  @ApiProperty() errors_1h!: number;
  @ApiProperty() errors_24h!: number;
  @ApiProperty() warns_24h!: number;
  @ApiPropertyOptional({ type: String, nullable: true }) oldest!: string | null;
}
export class AdminBroadcastStatsResponseDto {
  @ApiProperty() published!: number;
  @ApiProperty() draft!: number;
}
export class AdminAuditStatsResponseDto {
  @ApiProperty() total!: number;
  @ApiProperty() last_24h!: number;
}
export class AdminApiStatsResponseDto {
  @ApiProperty() uptime_seconds!: number;
  @ApiProperty() db_latency_ms!: number;
  @ApiProperty() version!: string;
  @ApiProperty() node_env!: string;
  @ApiProperty() telemetry_pending!: number;
}
export class PlatformStatsResponseDto {
  @ApiProperty({ type: AdminUsersStatsResponseDto })
  users!: AdminUsersStatsResponseDto;
  @ApiProperty({ type: AdminWorkspaceStatsResponseDto })
  workspaces!: AdminWorkspaceStatsResponseDto;
  @ApiProperty({ type: AdminLedgerStatsResponseDto })
  ledger!: AdminLedgerStatsResponseDto;
  @ApiProperty({ type: AdminEventStatsResponseDto })
  events!: AdminEventStatsResponseDto;
  @ApiProperty({ type: AdminBroadcastStatsResponseDto })
  broadcasts!: AdminBroadcastStatsResponseDto;
  @ApiProperty({ type: AdminAuditStatsResponseDto })
  audit!: AdminAuditStatsResponseDto;
  @ApiProperty() generated_at!: string;
  @ApiProperty({ type: AdminApiStatsResponseDto })
  api!: AdminApiStatsResponseDto;
}

export class HealthCheckResponseDto {
  @ApiProperty() name!: string;
  @ApiProperty() ok!: boolean;
  @ApiProperty() latency_ms!: number;
  @ApiPropertyOptional({ type: String, nullable: true }) error!: string | null;
}
export class AdminHealthResponseDto {
  @ApiProperty({ enum: ['healthy', 'degraded'] }) status!: string;
  @ApiProperty({ type: [HealthCheckResponseDto] })
  checks!: HealthCheckResponseDto[];
  @ApiProperty() checked_at!: string;
}

export class SystemEventResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty({ enum: ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] })
  level!: string;
  @ApiProperty() source!: string;
  @ApiProperty() event_code!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ type: String, nullable: true }) request_id!: string | null;
  @ApiProperty({ type: String, nullable: true }) actor_id!: string | null;
  @ApiProperty({ type: String, nullable: true }) route!: string | null;
  @ApiProperty({ type: String, nullable: true }) method!: string | null;
  @ApiProperty({ type: Number, nullable: true }) status_code!: number | null;
  @ApiProperty({ type: Number, nullable: true }) latency_ms!: number | null;
  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata!: Record<string, unknown>;
  @ApiProperty() created_at!: string;
}
export class SystemEventPageResponseDto {
  @ApiProperty({ type: [SystemEventResponseDto] })
  items!: SystemEventResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() offset!: number;
}

export class AuditEventResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, nullable: true }) workspace_id!: string | null;
  @ApiProperty({ type: String, nullable: true }) actor_id!: string | null;
  @ApiProperty() action!: string;
  @ApiProperty() resource_type!: string;
  @ApiProperty({ type: String, nullable: true }) resource_id!: string | null;
  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata!: Record<string, unknown>;
  @ApiProperty() created_at!: string;
}
export class AuditEventPageResponseDto {
  @ApiProperty({ type: [AuditEventResponseDto] })
  items!: AuditEventResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() offset!: number;
}

export class AdminUserResponseDto {
  @ApiProperty() user_id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() display_name!: string;
  @ApiProperty() locale!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty() base_currency!: string;
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED', 'PENDING_DELETION'] })
  status!: string;
  @ApiProperty() is_super_admin!: boolean;
  @ApiProperty() onboarding_status!: string;
  @ApiProperty() created_at!: string;
  @ApiProperty({ type: String, nullable: true }) last_sign_in_at!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) email_confirmed_at!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) banned_until!: string | null;
  @ApiProperty({ type: String, nullable: true }) suspended_at!: string | null;
  @ApiProperty({ type: String, nullable: true }) suspended_reason!:
    string | null;
  @ApiProperty({ type: String, nullable: true }) deletion_scheduled_for!:
    string | null;
  @ApiProperty() provider_count!: number;
  @ApiProperty() workspace_count!: number;
  @ApiProperty() account_count!: number;
  @ApiProperty() entry_count!: number;
  @ApiProperty({ type: String, nullable: true }) last_entry_at!: string | null;
}
export class AdminUserPageResponseDto {
  @ApiProperty({ type: [AdminUserResponseDto] }) items!: AdminUserResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() offset!: number;
}

export class AppSettingResponseDto {
  @ApiProperty() key!: string;
  @ApiProperty({ type: 'object', additionalProperties: true }) value!: Record<
    string,
    unknown
  >;
  @ApiProperty() is_public!: boolean;
  @ApiProperty() description!: string;
  @ApiProperty({ type: String, nullable: true }) updated_by!: string | null;
  @ApiProperty() updated_at!: string;
}
export class SiteSettingResponseDto {
  @ApiProperty() key!: string;
  @ApiProperty({ type: String, nullable: true }) value!: string | null;
  @ApiProperty({ type: String, nullable: true }) label!: string | null;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty() updated_at!: string;
}
export class DonationPaymentMethodResponseDto {
  @ApiProperty({ enum: ['paypal', 'bkash', 'bank', 'link'] }) method!: string;
  @ApiProperty() label!: string;
  @ApiPropertyOptional() account?: string;
  @ApiPropertyOptional() url?: string;
  @ApiPropertyOptional() note?: string;
}
export class DonationOptionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['development', 'palestine'] }) type!: string;
  @ApiProperty() title!: string;
  @ApiProperty() subtitle!: string;
  @ApiProperty() description!: string;
  @ApiProperty() icon!: string;
  @ApiProperty() color_from!: string;
  @ApiProperty() color_to!: string;
  @ApiProperty() is_active!: boolean;
  @ApiProperty() display_order!: number;
  @ApiProperty({ type: [DonationPaymentMethodResponseDto] })
  payment_methods!: DonationPaymentMethodResponseDto[];
}
export class AdminSiteSettingsResponseDto {
  @ApiProperty({ type: [SiteSettingResponseDto] })
  settings!: SiteSettingResponseDto[];
  @ApiProperty({ type: [DonationOptionResponseDto] })
  donation_options!: DonationOptionResponseDto[];
}
export class SiteLogoResponseDto {
  @ApiProperty({ type: String, nullable: true }) url!: string | null;
}
export class BroadcastDeliveryStatsResponseDto {
  @ApiProperty() seen!: number;
  @ApiProperty() dismissed!: number;
}
export class AdminBroadcastResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'] })
  severity!: string;
  @ApiProperty({ enum: ['ALL', 'SUPER_ADMINS'] }) audience!: string;
  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] }) status!: string;
  @ApiProperty() title_en!: string;
  @ApiProperty() title_bn!: string;
  @ApiProperty() body_en!: string;
  @ApiProperty() body_bn!: string;
  @ApiProperty({ type: String, nullable: true }) link_url!: string | null;
  @ApiProperty() dismissible!: boolean;
  @ApiProperty({ type: String, nullable: true }) publish_at!: string | null;
  @ApiProperty({ type: String, nullable: true }) expires_at!: string | null;
  @ApiProperty() created_at!: string;
  @ApiProperty({ type: BroadcastDeliveryStatsResponseDto })
  stats!: BroadcastDeliveryStatsResponseDto;
}
export class MobileReleaseResponseDto {
  @ApiProperty() latest_version!: string;
  @ApiProperty() min_version!: string;
  @ApiProperty({ type: String, nullable: true }) ios_url!: string | null;
  @ApiProperty({ type: String, nullable: true }) android_url!: string | null;
  @ApiProperty({ type: String, nullable: true }) apk_url!: string | null;
  @ApiProperty({ type: String, nullable: true }) apk_sha256!: string | null;
  @ApiProperty({ type: String, nullable: true }) release_notes_url!:
    string | null;
  @ApiProperty({ enum: ['COMING_SOON', 'LIVE'] }) ios_status!: string;
  @ApiProperty({ enum: ['COMING_SOON', 'LIVE'] }) android_status!: string;
  @ApiProperty({ type: Number, nullable: true }) apk_size_bytes!: number | null;
  @ApiProperty({ type: String, nullable: true }) released_at!: string | null;
  @ApiProperty() ios_minimum!: string;
  @ApiProperty() android_minimum!: string;
}

export class RoutePerformanceResponseDto {
  @ApiProperty() route!: string;
  @ApiProperty() count!: number;
  @ApiProperty() p50!: number;
  @ApiProperty() p95!: number;
  @ApiProperty() p99!: number;
  @ApiProperty() error_count!: number;
}
export class PerformanceMetricsResponseDto {
  @ApiProperty() window_hours!: number;
  @ApiProperty() total_requests!: number;
  @ApiProperty() error_count!: number;
  @ApiProperty() client_error_count!: number;
  @ApiProperty() error_rate!: number;
  @ApiProperty() p50!: number;
  @ApiProperty() p95!: number;
  @ApiProperty() p99!: number;
  @ApiProperty({ type: [RoutePerformanceResponseDto] })
  slowest_routes!: RoutePerformanceResponseDto[];
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  by_platform!: Record<string, number>;
  @ApiProperty() computed_at!: string;
}
export class ScheduledJobResponseDto {
  @ApiProperty() jobid!: number;
  @ApiProperty() jobname!: string;
  @ApiProperty() schedule!: string;
  @ApiProperty() command!: string;
  @ApiProperty() nodename!: string;
  @ApiProperty() nodeport!: number;
  @ApiProperty() database!: string;
  @ApiProperty() username!: string;
  @ApiProperty() active!: boolean;
  @ApiProperty({ type: String, nullable: true }) next_run!: string | null;
}
export class ScheduledJobsResponseDto {
  @ApiProperty({ type: [ScheduledJobResponseDto] })
  jobs!: ScheduledJobResponseDto[];
  @ApiProperty() run_at!: string;
}
export class AlertStateResponseDto {
  @ApiProperty() alert_key!: string;
  @ApiProperty() is_firing!: boolean;
  @ApiProperty({ type: String, nullable: true }) last_fired_at!: string | null;
  @ApiProperty({ type: String, nullable: true }) last_resolved_at!:
    string | null;
  @ApiProperty({ type: Number, nullable: true }) last_value!: number | null;
  @ApiProperty() updated_at!: string;
}
export class AuthAuditEventResponseDto extends AuditEventResponseDto {
  @ApiProperty({ type: String, nullable: true }) ip_address!: string | null;
  @ApiProperty({ type: String, nullable: true }) user_agent!: string | null;
  @ApiProperty({ type: String, nullable: true }) platform!: string | null;
  @ApiProperty({ type: String, nullable: true }) device_id!: string | null;
}
export class AuthAuditPageResponseDto {
  @ApiProperty({ type: [AuthAuditEventResponseDto] })
  items!: AuthAuditEventResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() offset!: number;
}
export class DeviceSessionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() user_id!: string;
  @ApiProperty() device_id!: string;
  @ApiProperty({ enum: ['web', 'ios', 'android'] }) platform!: string;
  @ApiProperty({ type: String, nullable: true }) device_name!: string | null;
  @ApiProperty({ type: String, nullable: true }) os_version!: string | null;
  @ApiProperty({ type: String, nullable: true }) app_version!: string | null;
  @ApiProperty() last_seen_at!: string;
  @ApiProperty({ type: String, nullable: true }) last_ip!: string | null;
  @ApiProperty() first_seen_at!: string;
}
export class DeviceSessionPageResponseDto {
  @ApiProperty({ type: [DeviceSessionResponseDto] })
  items!: DeviceSessionResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() offset!: number;
}
export class RevokedBooleanResponseDto {
  @ApiProperty() revoked!: boolean;
}
export class RevokedCountResponseDto {
  @ApiProperty() revoked!: number;
}
export class NewDeviceAnomalyResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() user_id!: string;
  @ApiProperty() platform!: string;
  @ApiProperty({ type: String, nullable: true }) device_name!: string | null;
  @ApiProperty() first_seen_at!: string;
  @ApiProperty({ type: String, nullable: true }) last_ip!: string | null;
}
export class ThrottleAnomalyResponseDto {
  @ApiProperty() actor_id!: string;
  @ApiProperty() hit_count!: number;
}
export class AnomaliesResponseDto {
  @ApiProperty({ type: [NewDeviceAnomalyResponseDto] })
  new_devices!: NewDeviceAnomalyResponseDto[];
  @ApiProperty({ type: [ThrottleAnomalyResponseDto] })
  throttle_abusers!: ThrottleAnomalyResponseDto[];
}
