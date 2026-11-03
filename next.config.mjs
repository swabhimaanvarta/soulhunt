/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["mongoose"],
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
  async redirects() {
    return [
      {
        source: "/signup",
        destination: "/register",
        permanent: false,
      },
      {
        source: "/signin",
        destination: "/login",
        permanent: false,
      },
      {
        source: "/inventory",
        destination: "/profile?tab=locker",
        permanent: false,
      },
      {
        source: "/items/lost",
        destination: "/lost-and-found/report-lost",
        permanent: false,
      },
      {
        source: "/items/found",
        destination: "/lost-and-found/report-found",
        permanent: false,
      },
      {
        source: "/staff/intake",
        destination: "/staff",
        permanent: false,
      },
      {
        source: "/admin/operations",
        destination: "/admin",
        permanent: false,
      },
    ];
  },
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

