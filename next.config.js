import path from 'path';

const nextConfig = {
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    serverActions: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      '@': './src',
      '@/lib': './src/lib',
      '@/components': './src/components',
      '@/hooks': './src/hooks',
      '@/services': './src/services',
      '@/types': './src/types',
      '@/utils': './src/utils',
    };
    return config;
  },
  swcMinify: true,
  compress: true,
  poweredByHeader: false,
};

export default nextConfig;