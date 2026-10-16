import type { NextConfig } from "next";

// Optional same-origin proxy. When API_PROXY_TARGET is set (e.g. http://127.0.0.1:8000),
// requests to /api/* are forwarded to the FastAPI backend, so no CORS config is needed.
// Then set NEXT_PUBLIC_DEFAULT_API_URL=/api.
const proxyTarget = process.env.API_PROXY_TARGET;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    if (!proxyTarget) return [];
    return [{ source: "/api/:path*", destination: `${proxyTarget.replace(/\/$/, "")}/api/:path*` }];
  },
};

export default nextConfig;
