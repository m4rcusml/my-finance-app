import type { NextConfig } from 'next';
import { join } from 'node:path';

const nextConfig: NextConfig = {
  // Browser tests run beside the user's dev server without sharing its cache.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Keep browser requests on the frontend origin. This makes ngrok expose a
  // single endpoint while Next proxies API traffic to the local Nest server.
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://127.0.0.1:3001/api/v1/:path*',
      },
    ];
  },
  // Next 16 otherwise writes AGENTS.md and CLAUDE.md into the app on dev start.
  agentRules: false,
  reactCompiler: true,
  // Self-contained server bundle, so the Docker runtime stage needs no node_modules.
  output: 'standalone',
  // The repo is a pnpm workspace; without this Next guesses the wrong root when
  // another lockfile exists higher up the filesystem.
  outputFileTracingRoot: join(__dirname, '..', '..'),
  // Keep workspace sources visible to Turbopack during local development.
  transpilePackages: ['@finance/contracts'],
  // Playwright uses the loopback address so its browser and API share one
  // deterministic host; permit that dev origin for HMR as well.
  allowedDevOrigins: ['127.0.0.1', 'tonetic-semiprovincially-raeann.ngrok-free.dev'],
  typedRoutes: false,
};

export default nextConfig;
