/** @type {import('next').NextConfig} */
const nextConfig = {
  // Local-only internal tool. Keep the dev overlay and type-check on.
  typescript: { ignoreBuildErrors: false },
  poweredByHeader: false,
  turbopack: { root: import.meta.dirname },
}

export default nextConfig
