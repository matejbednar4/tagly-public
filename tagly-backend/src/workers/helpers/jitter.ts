export function jitter(ms: number, pct = 0.2) {
  const span = Math.floor(ms * pct);
  return ms + (Math.random() * 2 * span - span);
}
