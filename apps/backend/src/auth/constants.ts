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
 *   An opaque value, never a JWT: `base64url(32 random bytes)`. It contains no
 *   user id, family id, or other metadata.
 *   It exists in exactly two places: the `refresh_token` HttpOnly cookie, and
 *   the `refresh_tokens` table as a SHA-256 hash. A dump of the table therefore
 *   cannot be replayed. Only a successful hash lookup identifies its owner or
 *   family, so a forged token can never revoke another user's sessions.
 *
 * ROTATION + REUSE DETECTION
 *   Every `POST /auth/refresh` locks the presented row, marks it revoked, links
 *   it to one successor, and inserts that successor in the same transaction.
 *   Rotated rows remain as tombstones until expiry. Replaying a known tombstone
 *   revokes only its family; an unknown hash is rejected without side effects.
 *   A second legitimate request during the five-second response race gets 409
 *   without having its new cookie cleared.
 *
 * COOKIE SCOPE
 *   `refresh_token`: HttpOnly, `Secure`/`SameSite`/`Domain` from config, and
 *   `Path=/api/v1/auth` so it is never attached to any business endpoint —
 *   only auth routes can ever see it.
 *   `csrf_token`: HttpOnly and `Path=/`. The SPA obtains the matching value from
 *   `GET /auth/csrf`, so this also works when app and API use different hosts.
 *
 * CSRF
 *   Every state-changing business request authenticates with the Bearer access
 *   token, which a cross-site form post cannot set — so those routes need no
 *   CSRF token. The single exception is `POST /auth/refresh`, which is
 *   authenticated by a cookie and therefore *is* reachable by a cross-site
 *   request. It requires a double-submit token: first call `GET /auth/csrf`,
 *   then echo its JSON value in `X-CSRF-Token`; the browser supplies the
 *   matching HttpOnly cookie. Both values rotate after a successful refresh.
 */

/** HttpOnly cookie carrying the opaque refresh token. */
export const REFRESH_COOKIE_NAME = 'refresh_token';

/** HttpOnly cookie paired with the value returned by `GET /auth/csrf`. */
export const CSRF_COOKIE_NAME = 'csrf_token';

/** Header the SPA must echo the `csrf_token` cookie in. */
export const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * The refresh cookie is scoped to the auth routes only, so it is never sent to
 * `/accounts`, `/transactions`, ... A leak in one of those handlers' logs
 * cannot contain it.
 */
export const AUTH_COOKIE_PATH = `${API_PREFIX}/auth`;

/** The API needs this cookie on both the bootstrap and refresh endpoints. */
export const CSRF_COOKIE_PATH = '/';

/** Entropy of the entire opaque refresh token. */
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

/** A concurrent refresh already claimed this predecessor. */
export const REFRESH_CONFLICT_MESSAGE = 'Uma renovação desta sessão já está em andamento.';

/** Grace window for two requests that left the browser with the same cookie. */
export const REFRESH_CONCURRENCY_WINDOW_MS = 5_000;

/** Typed exactly, accents included, before an account is destroyed. */
export const ACCOUNT_DELETION_CONFIRMATION = 'EXCLUIR MINHA CONTA';

/** Normalises an e-mail for storage and lookup: trimmed and lowercased. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
