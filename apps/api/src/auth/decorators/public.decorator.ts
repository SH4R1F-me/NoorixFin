/**
 * @Public() decorator — marks routes as publicly accessible.
 * Bypasses SupabaseAuthGuard.
 */
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
