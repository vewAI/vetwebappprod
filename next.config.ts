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
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
  },
  serverExternalPackages: ["pdfkit", "fontkit", "restructure"],
};

export default nextConfig;
