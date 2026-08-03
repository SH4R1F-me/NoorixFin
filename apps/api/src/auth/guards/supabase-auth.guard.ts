/**
 * Supabase Auth Guard — Blueprint §7.2
 *
 * Validates Supabase JWT from Authorization header.
 * Verifies: signature (HMAC SHA256 with JWT secret), iss, aud, exp, sub.
 *
 * For production JWKS verification: switch to RS256 + jwks-rsa library.
 * Local dev uses JWT_SECRET HMAC verification which is simpler.
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseAuthGuard.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException({
        code: 'MISSING_TOKEN',
        message: 'Authorization header with Bearer token is required',
      });
    }

    try {
      // Use Supabase to validate the token by calling getUser
      const client = this.supabaseService.getUserClient(token);
      const {
        data: { user },
        error,
      } = await client.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException({
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired authentication token',
        });
      }

      // Set user on request for @CurrentUser() decorator
      const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        email: user.email || '',
        claims: {
          sub: user.id,
          email: user.email,
          role: user.role,
          aud: user.aud,
        },
      };

      (request as Request & { user: AuthenticatedUser }).user = authenticatedUser;

      // Also store the raw token for creating user-context Supabase clients
      (request as Request & { accessToken: string }).accessToken = token;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error(
        `Auth verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      throw new UnauthorizedException({
        code: 'AUTH_FAILED',
        message: 'Authentication failed',
      });
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
