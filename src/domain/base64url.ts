const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const LOOKUP = new Map([...ALPHABET].map((c, i) => [c, i]));

/** Base64url without padding. Written by hand so the domain needs no browser APIs. */
export function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const n = (a << 16) | (b << 8) | c;
    const chars = [(n >> 18) & 63, (n >> 12) & 63, (n >> 6) & 63, n & 63].map((v) => ALPHABET[v]);
    out += chars.slice(0, Math.min(4, bytes.length - i + 1)).join('');
  }
  return out;
}

export function fromBase64Url(text: string): Uint8Array {
  if (text.length % 4 === 1) throw new Error('Invalid base64url length');
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < text.length; i += 4) {
    const chunk = text.slice(i, i + 4);
    let n = 0;
    for (let j = 0; j < 4; j++) {
      const ch = chunk[j];
      const v = ch === undefined ? 0 : LOOKUP.get(ch);
      if (v === undefined) throw new Error(`Invalid base64url character ${ch}`);
      n = (n << 6) | v;
    }
    const bytes = [(n >> 16) & 255, (n >> 8) & 255, n & 255].slice(0, chunk.length - 1);
    for (const byte of bytes) out[o++] = byte;
  }
  return out;
}
