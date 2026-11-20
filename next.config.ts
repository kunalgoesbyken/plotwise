import type { NextConfig } from "next";
import { securityHeaders } from "./src/security/headers";

const APPLE_TOUCH_ICON_PATHS = ["/apple-touch-icon.png", "/apple-touch-icon-precomposed.png"];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(process.env.NODE_ENV === "development") }];
  },
  async rewrites() {
    return APPLE_TOUCH_ICON_PATHS.map((source) => ({ source, destination: "/apple-icon.png" }));
  },
};

export default nextConfig;
