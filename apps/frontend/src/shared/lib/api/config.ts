export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error(
      'NEXT_PUBLIC_API_URL is not set. Create apps/frontend/.env.local and set NEXT_PUBLIC_API_URL.'
    );
  }
  return url.replace(/\/+$/, ''); // remove trailing slash
}
