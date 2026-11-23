/**
 * Escape a user-supplied string so it can't inject markup into HTML — e.g. when
 * interpolating untrusted text into an email body. Replaces the five characters
 * that are significant in HTML (`& < > " '`).
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
