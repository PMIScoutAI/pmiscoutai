/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'sharp': 'sharp',
        'pdfjs-dist': 'pdfjs-dist'
      });
    }
    return config;
  },
};

module.exports = nextConfig;
