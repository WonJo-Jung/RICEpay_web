/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@reown/appkit', '@reown/appkit-utils', '@reown/appkit-adapter-wagmi'],
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      'pino-pretty': false,
      'pino-abstract-transport': false,
      'sonic-boom': false,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
};
export default nextConfig;