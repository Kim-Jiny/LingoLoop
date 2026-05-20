import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service.js';

/**
 * Allows the request through only if the `admin_session` cookie is
 * present and validates against the HMAC secret. Used for protecting
 * the dashboard data API consumed by the backstage HTML page.
 */
@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(private readonly auth: AdminAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const cookie = this.auth.readSessionFromCookieHeader(req.headers?.cookie);
    const username = this.auth.verifySession(cookie);
    if (!username) {
      throw new UnauthorizedException('Admin session required');
    }
    req.adminUsername = username;
    return true;
  }
}
