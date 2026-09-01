import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/**
 * Opts a route out of the globally-applied JwtAuthGuard.
 *
 * Auth is on by default and switched off per route, rather than off by default
 * and switched on — forgetting the decorator then fails closed, not open.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route to the listed roles. Enforced by RolesGuard. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

/** Injects the authenticated user that JwtAuthGuard attached to the request. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
  return request.user;
});
