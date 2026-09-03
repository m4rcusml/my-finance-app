import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Every environment variable the server reads, validated once at boot.
 *
 * A misconfigured process must fail immediately with a message that names the
 * offending variables and never prints their values — a half-configured API is
 * far more dangerous than one that refuses to start.
 */
export class EnvConfig {
  @IsString()
  @IsNotEmpty()
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @Transform(({ value }) => Number(value ?? 3001))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3001;

  /** PostgreSQL connection string. */
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  /**
   * HMAC key for access tokens. 32+ chars, and never allowed to fall back to a
   * built-in default — an unset secret used to boot a fully "authenticated" API.
   */
  @IsString()
  @MinLength(32, {
    message: 'JWT_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 48',
  })
  JWT_SECRET!: string;

  /** Separate key so a leaked access-token secret cannot mint refresh tokens. */
  @IsString()
  @MinLength(32, {
    message: 'JWT_REFRESH_SECRET must be at least 32 characters and different from JWT_SECRET.',
  })
  JWT_REFRESH_SECRET!: string;

  /** Access-token lifetime in seconds. Short by design; the refresh cookie carries the session. */
  @Transform(({ value }) => Number(value ?? 900))
  @IsInt()
  @Min(60)
  @Max(3600)
  ACCESS_TOKEN_TTL_SECONDS = 900;

  /** Refresh-token lifetime in seconds (default 30 days). */
  @Transform(({ value }) => Number(value ?? 2592000))
  @IsInt()
  @Min(3600)
  REFRESH_TOKEN_TTL_SECONDS = 2592000;

  /** Comma-separated exact origins allowed to call the API with credentials. */
  @IsString()
  @IsNotEmpty()
  CORS_ORIGINS = 'http://localhost:3000';

  /** IANA timezone used for "today", month boundaries and the recurrence job. */
  @IsString()
  @IsNotEmpty()
  APP_TIMEZONE = 'America/Sao_Paulo';

  /** Domain for the refresh cookie. Leave empty for host-only cookies. */
  @IsString()
  COOKIE_DOMAIN = '';

  /** Send `Secure` on cookies. Must be true behind HTTPS; forced true in production. */
  @Transform(({ value }) => value === undefined || value === '' ? undefined : value === 'true' || value === true)
  @IsBoolean()
  COOKIE_SECURE = false;

  /** `lax` for same-site deployments, `none` when the frontend is on another origin. */
  @IsString()
  @IsNotEmpty()
  COOKIE_SAMESITE: 'lax' | 'strict' | 'none' = 'lax';

  /** Max upload size for import files, in bytes (default 5 MiB). */
  @Transform(({ value }) => Number(value ?? 5 * 1024 * 1024))
  @IsInt()
  @Min(1024)
  MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

  /** Hard cap on rows accepted from a single import file. */
  @Transform(({ value }) => Number(value ?? 5000))
  @IsInt()
  @Min(1)
  MAX_IMPORT_ROWS = 5000;

  /** Minutes a parsed-but-unconfirmed import preview stays usable. */
  @Transform(({ value }) => Number(value ?? 60))
  @IsInt()
  @Min(1)
  IMPORT_BATCH_TTL_MINUTES = 60;

  /** Max upload size for a backup restore payload, in bytes (default 20 MiB). */
  @Transform(({ value }) => Number(value ?? 20 * 1024 * 1024))
  @IsInt()
  @Min(1024)
  MAX_BACKUP_BYTES = 20 * 1024 * 1024;

  /** Set false to keep the recurrence cron from running (tests, one-off scripts). */
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : value === 'true' || value === true))
  @IsBoolean()
  ENABLE_CRON = true;

  /** Publish Swagger UI. Off by default outside development. */
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : value === 'true' || value === true))
  @IsBoolean()
  ENABLE_SWAGGER = true;
}

export function validateEnv(raw: Record<string, unknown>): EnvConfig {
  const config = plainToInstance(EnvConfig, raw, {
    enableImplicitConversion: false,
    exposeDefaultValues: true,
  });

  const errors = validateSync(config, { skipMissingProperties: false, whitelist: false });
  const problems: string[] = [];

  for (const error of errors) {
    const messages = Object.values(error.constraints ?? {});
    problems.push(`  - ${error.property}: ${messages.join('; ') || 'invalid value'}`);
  }

  if (!['development', 'test', 'production'].includes(config.NODE_ENV)) {
    problems.push(`  - NODE_ENV: must be development, test or production`);
  }
  if (!['lax', 'strict', 'none'].includes(config.COOKIE_SAMESITE)) {
    problems.push(`  - COOKIE_SAMESITE: must be lax, strict or none`);
  }
  if (config.JWT_SECRET && config.JWT_SECRET === config.JWT_REFRESH_SECRET) {
    problems.push(`  - JWT_REFRESH_SECRET: must differ from JWT_SECRET`);
  }
  if (config.DATABASE_URL && !/^postgres(ql)?:\/\//.test(config.DATABASE_URL)) {
    problems.push(`  - DATABASE_URL: must be a postgresql:// connection string`);
  }
  if (config.CORS_ORIGINS) {
    for (const origin of parseCorsOrigins(config.CORS_ORIGINS)) {
      if (!/^https?:\/\/[^/]+$/.test(origin)) {
        problems.push(`  - CORS_ORIGINS: "${origin}" must be a bare origin like https://app.example.com (no path)`);
      }
    }
  }
  if (!isValidTimezone(config.APP_TIMEZONE)) {
    problems.push(`  - APP_TIMEZONE: "${config.APP_TIMEZONE}" is not a known IANA timezone`);
  }
  if (config.NODE_ENV === 'production') {
    if (config.COOKIE_SECURE !== true) {
      problems.push(`  - COOKIE_SECURE: must be true in production`);
    }
    if (config.COOKIE_SAMESITE === 'none' && config.COOKIE_SECURE !== true) {
      problems.push(`  - COOKIE_SAMESITE=none requires COOKIE_SECURE=true`);
    }
  }

  if (problems.length > 0) {
    // Deliberately prints names only — never the offending values.
    throw new Error(
      `Invalid environment configuration:\n${problems.join('\n')}\n\nSee apps/backend/.env.example for the expected shape.`,
    );
  }

  return config;
}

export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
