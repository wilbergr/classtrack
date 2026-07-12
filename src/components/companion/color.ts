// Tiny hex color math for the rig's derived shading: light/dark stops are
// computed from the theme's companion tint, so every palette shades correctly
// without new tokens and nothing is ever hardcoded.

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Mix `hex` toward white by `amt` (0..1). */
export function lighten(hex: string, amt: number): string {
  const [r, g, b] = parseHex(hex);
  return toHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}

/** Mix `hex` toward black by `amt` (0..1). */
export function darken(hex: string, amt: number): string {
  const [r, g, b] = parseHex(hex);
  return toHex(r * (1 - amt), g * (1 - amt), b * (1 - amt));
}

/** Mix two hex colors; t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}
