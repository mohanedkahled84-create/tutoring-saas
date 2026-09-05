import net from "node:net";

export interface SSRFOptions {
  allowedProtocols?: string[];
  allowedHosts?: string[];
  disallowPrivateIps?: boolean;
}

/**
 * Checks if an IP or hostname resolves to private, loopback, link-local, or cloud metadata ranges.
 */
export function isPrivateOrInternalIp(ipOrHost: string): boolean {
  const cleanHost = ipOrHost.trim().toLowerCase().replace(/^\[|\]$/g, "");

  // Known metadata and local hostnames
  if (
    cleanHost === "localhost" ||
    cleanHost.endsWith(".localhost") ||
    cleanHost.endsWith(".local") ||
    cleanHost.endsWith(".internal") ||
    cleanHost === "metadata.google.internal" ||
    cleanHost === "instance-data"
  ) {
    return true;
  }

  // Handle IPv4 decimal/hex notations (e.g. 2130706433, 0x7f.0.0.1)
  let ipToCheck = cleanHost;
  if (/^\d+$/.test(cleanHost)) {
    const num = parseInt(cleanHost, 10);
    if (!isNaN(num) && num >= 0 && num <= 4294967295) {
      ipToCheck = [
        (num >>> 24) & 255,
        (num >>> 16) & 255,
        (num >>> 8) & 255,
        num & 255,
      ].join(".");
    }
  } else if (/^0x[0-9a-f]+$/i.test(cleanHost)) {
    const num = parseInt(cleanHost, 16);
    if (!isNaN(num) && num >= 0 && num <= 4294967295) {
      ipToCheck = [
        (num >>> 24) & 255,
        (num >>> 16) & 255,
        (num >>> 8) & 255,
        num & 255,
      ].join(".");
    }
  }

  // Check IPv4
  if (net.isIPv4(ipToCheck)) {
    const parts = ipToCheck.split(".").map(Number);
    const [p0, p1] = parts;

    // 0.0.0.0/8
    if (p0 === 0) return true;
    // 127.0.0.0/8 (Loopback)
    if (p0 === 127) return true;
    // 10.0.0.0/8 (Private Class A)
    if (p0 === 10) return true;
    // 172.16.0.0/12 (Private Class B: 172.16.0.0 - 172.31.255.255)
    if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;
    // 192.168.0.0/16 (Private Class C)
    if (p0 === 192 && p1 === 168) return true;
    // 169.254.0.0/16 (Link-local & AWS/GCP/Azure metadata service 169.254.169.254)
    if (p0 === 169 && p1 === 254) return true;
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (p0 === 100 && p1 >= 64 && p1 <= 127) return true;
    // 198.18.0.0/15 (Benchmarking)
    if (p0 === 198 && (p1 === 18 || p1 === 19)) return true;
    // 224.0.0.0/4 (Multicast)
    if (p0 >= 224 && p0 <= 239) return true;
    // 240.0.0.0/4 (Reserved)
    if (p0 >= 240) return true;

    return false;
  }

  // Check IPv6
  if (net.isIPv6(ipToCheck)) {
    // Loopback & Unspecified
    if (ipToCheck === "::1" || ipToCheck === "::" || ipToCheck === "0:0:0:0:0:0:0:1") {
      return true;
    }
    // IPv4-mapped IPv6 (::ffff:127.0.0.1, etc.)
    if (ipToCheck.toLowerCase().startsWith("::ffff:")) {
      const v4Part = ipToCheck.substring(7);
      if (net.isIPv4(v4Part)) {
        return isPrivateOrInternalIp(v4Part);
      }
    }
    // Unique local address (fc00::/7 -> fc.. or fd..)
    if (ipToCheck.toLowerCase().startsWith("fc") || ipToCheck.toLowerCase().startsWith("fd")) {
      return true;
    }
    // Link-local unicast (fe80::/10 -> fe8, fe9, fea, feb)
    if (/^fe[89ab]/i.test(ipToCheck)) {
      return true;
    }
    // Multicast (ff00::/8)
    if (ipToCheck.toLowerCase().startsWith("ff")) {
      return true;
    }
    return false;
  }

  return false;
}

/**
 * Validates a URL to protect against SSRF (Server-Side Request Forgery).
 */
export function validateUrlForSSRF(
  urlStr: string,
  options: SSRFOptions = {}
): { isValid: boolean; error?: string; parsedUrl?: URL } {
  const allowedProtocols = options.allowedProtocols || ["http:", "https:"];
  const disallowPrivateIps = options.disallowPrivateIps ?? true;

  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { isValid: false, error: "Invalid URL format" };
  }

  // 1. Protocol check
  if (!allowedProtocols.includes(parsed.protocol)) {
    return {
      isValid: false,
      error: `Protocol '${parsed.protocol}' is not allowed. Only ${allowedProtocols.join(", ")} permitted.`,
    };
  }

  const hostname = parsed.hostname;

  // 2. Allowed hosts check (if specified)
  if (options.allowedHosts && options.allowedHosts.length > 0) {
    const isAllowedHost = options.allowedHosts.some((allowed) => {
      if (allowed.startsWith("*.")) {
        const root = allowed.slice(2);
        return hostname === root || hostname.endsWith("." + root);
      }
      return hostname.toLowerCase() === allowed.toLowerCase();
    });

    if (!isAllowedHost) {
      return {
        isValid: false,
        error: `Host '${hostname}' is not in the allowed hosts list`,
      };
    }
  }

  // 3. Private / Internal IP check
  if (disallowPrivateIps && isPrivateOrInternalIp(hostname)) {
    return {
      isValid: false,
      error: `Access to internal/private network destination '${hostname}' is strictly prohibited`,
    };
  }

  return { isValid: true, parsedUrl: parsed };
}

/**
 * Safe fetch wrapper that validates URL against SSRF before initiating any network connection.
 */
export async function safeFetch(
  url: string,
  init?: RequestInit,
  options?: SSRFOptions
): Promise<Response> {
  const validation = validateUrlForSSRF(url, options);
  if (!validation.isValid) {
    throw new Error(`SSRF_PROHIBITED: ${validation.error}`);
  }

  return fetch(url, init);
}
