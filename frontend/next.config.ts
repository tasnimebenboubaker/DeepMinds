import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  rewrites: async () => {
    return {
      beforeFiles: [
        {
          source: '/api/recommendations/:path*',
          destination: 'http://localhost:8000/api/recommendations/:path*',
        },
        {
          source: '/api/search/:path*',
          destination: 'http://localhost:8000/api/search/:path*',
        },
        
      ],
    };
  },
};

export default nextConfig;
