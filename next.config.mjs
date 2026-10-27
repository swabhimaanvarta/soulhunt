/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    // In local development on Windows, use in-memory cache to prevent
    // PackFileCacheStrategy ENOENT file-locking errors ('0.pack.gz_' -> '0.pack.gz')
    // which cause CSS chunk 404s and missing module errors.
    if (dev) {
      config.cache = {
        type: "memory",
      };
    }
    return config;
  },
  experimental: {},
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;

