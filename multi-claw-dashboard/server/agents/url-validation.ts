/**
 * Validate agent URLs to prevent SSRF attacks.
 * In production, blocks localhost, loopback, link-local, and cloud metadata endpoints.
 * In development, allows localhost but still blocks metadata endpoints.
 */
export function validateAgentUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;

    const host = parsed.hostname.toLowerCase();
    const isProduction = process.env.NODE_ENV === "production";

    // Always block cloud metadata endpoints
    if (host === "metadata.google.internal") return false;
    if (host.startsWith("169.254.")) return false;  // AWS/Azure metadata (link-local)

    // Block loopback in production
    if (isProduction) {
      if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return false;
      if (host === "0.0.0.0") return false;
    }

    // Block private ranges in production
    if (isProduction) {
      // RFC 1918
      if (host.startsWith("10.")) return false;
      if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
      if (host.startsWith("192.168.")) return false;
    }

    // Block port 0 (invalid)
    if (parsed.port === "0") return false;

    return true;
  } catch {
    return false;
  }
}
