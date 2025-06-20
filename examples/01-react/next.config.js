/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  webpack(config, { isServer }) {
    if (isServer) {
      config.resolve.alias['canvas'] = path.resolve(__dirname, 'server-canvas.js');
    }
    return config;
  },
};

module.exports = nextConfig;
