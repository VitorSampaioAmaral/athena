/** @type {import('next').NextConfig} */
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
    serverActions: {
      bodySizeLimit: '50mb',
      allowedOrigins: ['*'],
    },
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      encoding: false,
    };
    
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, 'src'),
      '@/lib': require('path').resolve(__dirname, 'src/lib'),
      '@/components': require('path').resolve(__dirname, 'src/components'),
      '@/hooks': require('path').resolve(__dirname, 'src/hooks'),
      '@/services': require('path').resolve(__dirname, 'src/services'),
      '@/types': require('path').resolve(__dirname, 'src/types'),
      '@/utils': require('path').resolve(__dirname, 'src/utils'),
    };
    
    return config;
  },
  // Configurações para melhorar o build
  swcMinify: true,
  compress: true,
  poweredByHeader: false,
}

module.exports = nextConfig 