import type { NextConfig } from "next";

const remotePatterns: { protocol: "https"; hostname: string; pathname: string }[] = [];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (supabaseUrl) {
  try {
    const { hostname } = new URL(supabaseUrl);
    remotePatterns.push({
      protocol: "https",
      hostname,
      pathname: "/storage/v1/object/public/**",
    });
    remotePatterns.push({
      protocol: "https",
      hostname,
      pathname: "/storage/v1/object/sign/**",
    });
  } catch (error) {
    console.warn("Invalid NEXT_PUBLIC_SUPABASE_URL for image config", error);
  }
}

if (!remotePatterns.length) {
  remotePatterns.push({
    protocol: "https",
    hostname: "*.supabase.co",
    pathname: "/storage/v1/object/public/**",
  });
  remotePatterns.push({
    protocol: "https",
    hostname: "*.supabase.co",
    pathname: "/storage/v1/object/sign/**",
  });
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
  // Report-only first: this gives us CSP violation telemetry without breaking
  // the existing voice/AI integrations before their origins are fully mapped.
  {
    key: "Content-Security-Policy-Report-Only",
    value: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https://*.supabase.co https://api.openai.com https://generativelanguage.googleapis.com wss://generativelanguage.googleapis.com;",
  },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  serverExternalPackages: ["pdfkit", "fontkit", "restructure"],
};

export default nextConfig;
