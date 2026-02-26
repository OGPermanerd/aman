import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: ['10.248.10.107'],
}

export default nextConfig
