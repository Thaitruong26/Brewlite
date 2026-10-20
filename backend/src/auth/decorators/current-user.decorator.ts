import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Injects the authenticated user into a route handler parameter.
 *  Usage: @CurrentUser() user: AuthUser
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: unknown }>();
    return request.user;
  },
);
