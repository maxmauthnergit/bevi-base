import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  // Old link to the page that is now "Sales"
  async redirects() {
    return [
      { source: '/dashboard/sales-2', destination: '/dashboard/sales', permanent: false },
    ]
  },
};

export default nextConfig;
