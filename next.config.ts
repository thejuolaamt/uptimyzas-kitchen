import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  
  // Fix Turbopack root warning
  turbopack: {
    root: process.cwd(),
  },
}

export default nextConfig