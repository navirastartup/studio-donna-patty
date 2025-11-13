import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "qfohfrgmdjvmmilccpro.supabase.co",
        pathname: "/storage/v1/object/public/**", // libera todos os arquivos públicos do Supabase
      },
    ],
  },
};

export default nextConfig;
