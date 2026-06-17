/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // mupdf (PDF→Foto-Extraktion) ist ESM mit top-level await – nicht bundlen.
  experimental: {
    serverComponentsExternalPackages: ["mupdf"],
    // CV-Upload über Server Actions (öffentlicher Stellen-Link) – Default 1 MB zu klein.
    serverActions: { bodySizeLimit: "10mb" },
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
