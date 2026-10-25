/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite importar ../config/mantequilla.json (la misma configuración que usa el worker).
  experimental: { externalDir: true },
  poweredByHeader: false,
};
export default nextConfig;
