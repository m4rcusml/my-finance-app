import { SetMetadata } from '@nestjs/common';

/**
 * Opts a handler (or a whole controller) out of the globally registered
 * `AuthGuard`. The guard is a global `APP_GUARD`, so the default for every
 * route is "authenticated"; forgetting this decorator locks a route down
 * rather than opening it up, which is the failure mode we want.
 */
export const IS_PUBLIC_KEY = 'isPublic';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
