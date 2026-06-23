/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
   outputFileTracingIncludes: {
     '/api/offers/generate-pdf': ['./public/fonts/**'],
     '/api/offers/send-email': ['./public/fonts/**'],
  },
}

module.exports = nextConfig
