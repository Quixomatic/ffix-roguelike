/**
 * Return `to` only if it's a safe LOCAL path: starts with a single "/", no scheme, no protocol-relative "//". Used to
 * honour a `?redirect=` return path after signing in without opening an open-redirect hole (a malicious
 * `?redirect=https://evil.tld` is rejected, and callers fall back to their default destination). From ChannelGuide.
 */
export function safeRedirect(to: string | null | undefined): string | null {
  if (!to || typeof to !== "string") return null;
  if (!to.startsWith("/") || to.startsWith("//")) return null;
  return to;
}
