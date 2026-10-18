/** @type {import('next').NextConfig} */

// Private financial tool: never framed, never indexed, never cached by a shared cache.
const securityHeaders = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self' https://accounts.google.com" },
]

const nextConfig = {
  typescript: { ignoreBuildErrors: false },
  poweredByHeader: false,
  turbopack: { root: import.meta.dirname },
  // Hosted, the real ledger comes from the FN_LEDGER_BR environment variable. Ship the
  // fake sample with the server function so a missing variable shows sample data, banner and all.
  outputFileTracingIncludes: { '/': ['./data/sample/**'] },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
