import { API_PREFIX } from '@finance/contracts';

/**
 * ---------------------------------------------------------------------------
 * V1 SESSION DESIGN (implemented across auth.service.ts / auth.controller.ts /
 * auth.guard.ts / cookies.ts — this comment is the specification)
 * ---------------------------------------------------------------------------
 *
 * ACCESS TOKEN
 *   A short-lived JWT (`ACCESS_TOKEN_TTL_SECONDS`, default 15 min) signed with
 *   `JWT_SECRET`. It is returned in the JSON body and the SPA is expected to
 *   keep it **in memory only** — never in `localStorage`, never in a cookie.
 *   Claims: `{ sub, email, tokenVersion }`. Every authenticated request carries
 *   it as `Authorization: Bearer <token>`.
 *
 * REFRESH TOKEN
 *   An opaque value, never a JWT, shaped `<userId>.<base64url(32 random bytes)>`.
 *   It exists in exactly two places: the `refresh_token` HttpOnly cookie, and
 *   the `refresh_tokens` table as a SHA-256 hash. A dump of the table therefore
 *   cannot be replayed. The `userId` prefix is not a secret and is not trusted
 *   for authentication — it exists only so that reuse detection can identify
 *   *which family* to kill once the row itself is gone (see below).
 *
 * ROTATION + REUSE DETECTION
 *   Every `POST /auth/refresh` deletes the presented row and inserts a fresh
 *   one, inside a single transaction. A token that hashes to no row was either
 *   forged or already rotated — i.e. somebody is replaying a stolen cookie — so
 *   the whole family (`DELETE FROM refresh_tokens WHERE user_id = ...`) is
 *   revoked and the response is a generic 401. The legitimate user is logged
 *   out and has to sign in again, which is the correct outcome for a theft.
 *
 * COOKIE SCOPE
 *   `refresh_token`: HttpOnly, `Secure`/`SameSite`/`Domain` from config, and
 *   `Path=/api/v1/auth` so it is never attached to any business endpoint —
 *   only the four auth routes can ever see it.
 *   `csrf_token`: NOT HttpOnly (the SPA must read it) and `Path=/` so
 *   `document.cookie` can see it from the app's own path.
 *
 * CSRF
 *   Every state-changing business request authenticates with the Bearer access
 *   token, which a cross-site form post cannot set — so those routes need no
 *   CSRF token. The single exception is `POST /auth/refresh`, which is
 *   authenticated by a cookie and therefore *is* reachable by a cross-site
 *   request. It requires a double-submit token: the `csrf_token` cookie value
 *   must equal the `X-CSRF-Token` header, which only same-origin JavaScript can
 *   read and set. Both are rotated on every refresh.
 */

/** HttpOnly cookie carrying the opaque refresh token. */
export const REFRESH_COOKIE_NAME = 'refresh_token';

/** Readable-by-JS cookie echoed back in `X-CSRF-Token` (double submit). */
export const CSRF_COOKIE_NAME = 'csrf_token';

/** Header the SPA must echo the `csrf_token` cookie in. */
export const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * The refresh cookie is scoped to the auth routes only, so it is never sent to
 * `/accounts`, `/transactions`, ... A leak in one of those handlers' logs
 * cannot contain it.
 */
export const AUTH_COOKIE_PATH = `${API_PREFIX}/auth`;

/** The CSRF cookie must be readable from the SPA's own path. */
export const CSRF_COOKIE_PATH = '/';

/** Entropy of the secret half of a refresh token. */
export const REFRESH_TOKEN_BYTES = 32;

/** Entropy of a CSRF token. */
export const CSRF_TOKEN_BYTES = 32;

/**
 * Login / register / refresh: at most 10 attempts per minute per IP.
 * The key is the throttler *name* configured in `app.module.ts` (`global`).
 */
export const AUTH_RATE_LIMIT = { limit: 10, ttl: 60_000 } as const;

/**
 * One sentence for every authentication failure. Deliberately identical for
 * "unknown e-mail" and "wrong password" so the endpoint is not an account
 * enumeration oracle.
 */
export const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha inválidos.';

/** Same reasoning for a bad/expired/replayed refresh cookie. */
export const INVALID_SESSION_MESSAGE = 'Sessão inválida ou expirada.';

/** Typed exactly, accents included, before an account is destroyed. */
export const ACCOUNT_DELETION_CONFIRMATION = 'EXCLUIR MINHA CONTA';

/** Normalises an e-mail for storage and lookup: trimmed and lowercased. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
