/**
 * Base URL of the API, including the `/api/v1` prefix.
 *
 * Read lazily (not at module load) so a missing variable surfaces as a rendered
 * error state instead of crashing the bundle during a server render.
 */
export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error(
      'NEXT_PUBLIC_API_URL não está definida. Copie apps/frontend/.env.example para .env.local.',
    );
  }
  return url.replace(/\/+$/, '');
}
