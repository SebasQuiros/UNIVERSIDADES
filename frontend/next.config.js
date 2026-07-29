/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // `missingSuspenseWithCSRBailout` se eliminó en Next 15. Servía para
    // silenciar el aviso de useSearchParams() sin Suspense; ya no hace falta
    // porque estas páginas se sirven dinámicamente, no se prerenderizan.
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
  },

  // Proxy de API — el navegador llama a /api/* y Next.js lo redirige al backend
  // Esto elimina problemas de CORS completamente
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },

  // Imágenes desde el backend
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
      },
    ],
  },

  // Headers de seguridad (defensa en profundidad, sin CSP estricta para no
  // romper Supabase/recharts/estilos en línea).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
