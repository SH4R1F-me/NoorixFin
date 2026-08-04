/**
 * Supabase Auth Guard — Blueprint §7.2, DEC-011
 *
 * Validates the Supabase JWT from the Authorization header **locally** via
 * JwtVerifierService (signature, iss, aud, exp).
 *
 * Previously this called `supabase.auth.getUser()`, a network round trip to the
 * Auth server on every authenticated request — the largest avoidable source of
 * API calls in the system. See jwt-verifier.service.ts for the revocation
 * trade-off that local verification accepts.
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
import { JwtVerifierService } from '../jwt-verifier.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseAuthGuard.name);

  constructor(
    private readonly jwtVerifier: JwtVerifierService,
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
      // Local verification — no network call (DEC-011).
      const claims = await this.jwtVerifier.verify(token);

      if (!claims.sub) {
        throw new UnauthorizedException({
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired authentication token',
        });
      }

      // Set user on request for @CurrentUser() decorator
      const authenticatedUser: AuthenticatedUser = {
        id: claims.sub,
        email: claims.email || '',
        claims: {
          sub: claims.sub,
          email: claims.email,
          role: claims.role,
          aud: typeof claims.aud === 'string' ? claims.aud : claims.aud?.[0],
        },
      };

      (request as Request & { user: AuthenticatedUser }).user =
        authenticatedUser;

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
