/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },

  transpilePackages: ['@reown/appkit', '@reown/appkit-utils', '@reown/appkit-adapter-wagmi'],
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      'pino-pretty': false,
      'pino-abstract-transport': false,
      'sonic-boom': false,
    };
    return config;
  },
};
export default nextConfig;