export function isValidSameOriginRelativePath(url?: string | null): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  // Must start with a single slash, not protocol-relative //, and not contain backslashes
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return false;
  }
  // Reject external schemes (http:, https:, javascript:, data:, vbscript:, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(trimmed)) {
    return false;
  }
  return true;
}

export function sanitizeNotificationLink(url?: string | null): string {
  if (isValidSameOriginRelativePath(url) && url) {
    return url.trim();
  }
  return "/dashboard";
}
