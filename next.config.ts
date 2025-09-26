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
  async redirects() {
    return [
      // Mantener compatibilidad si movemos los demos a /demo
      { source: '/POS-Qubito.html', destination: '/demo/POS-Qubito.html', permanent: true },
    ];
  },
};

export default nextConfig;
