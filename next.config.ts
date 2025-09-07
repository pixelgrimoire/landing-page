import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Permitir imágenes desde GitHub raw para el "open book"
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/microsoft/fluentui-emoji/**",
      },
    ],
  },
};

export default nextConfig;
