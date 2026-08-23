import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.dummyjson.com', pathname: '/**' }],
  },
  experimental: {
    // 启用 forbidden() / unauthorized()（403 / 401 页面）
    authInterrupts: true,
  },
};

export default nextConfig;
