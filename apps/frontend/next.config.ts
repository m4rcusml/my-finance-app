import type { NextConfig } from 'next';
import { join } from 'node:path';

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Self-contained server bundle, so the Docker runtime stage needs no node_modules.
  output: 'standalone',
  // The repo is a pnpm workspace; without this Next guesses the wrong root when
  // another lockfile exists higher up the filesystem.
  outputFileTracingRoot: join(__dirname, '..', '..'),
  // `@finance/contracts` ships TypeScript sources rather than a build step.
  transpilePackages: ['@finance/contracts'],
  typedRoutes: false,
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
