import dns from "node:dns/promises";
import net from "node:net";

const MAX_REDIRECTS = 3;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
  }

  return true;
}

async function assertSafeUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS URLs are allowed");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "metadata.google.internal" ||
    hostname === "metadata.google.com"
  ) {
    throw new Error("Private or metadata hosts are not allowed");
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Private or metadata addresses are not allowed");
  }

  return url;
}

/** Fetch a public HTTPS resource into a bounded in-memory response. */
export async function fetchPublicResource(
  rawUrl: string,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<Response> {
  let currentUrl = rawUrl;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const url = await assertSafeUrl(currentUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain, text/html" },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirect === MAX_REDIRECTS) {
          throw new Error("Too many or invalid redirects");
        }
        currentUrl = new URL(location, url).toString();
        continue;
      }

      const declaredLength = Number(response.headers.get("content-length") ?? 0);
      if (declaredLength > maxBytes) {
        throw new Error("Remote response exceeds the allowed size");
      }

      if (!response.body) {
        return new Response(null, { status: response.status, headers: response.headers });
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new Error("Remote response exceeds the allowed size");
        }
        chunks.push(value);
      }

      const body = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Too many redirects");
}
