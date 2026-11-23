/**
 * Escape interpolated text for safe use in email HTML — element text AND
 * quoted attribute values (the preheader lands in a `content="..."` attribute,
 * so quotes must be escaped too).
 */
export function escapeEmailHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
