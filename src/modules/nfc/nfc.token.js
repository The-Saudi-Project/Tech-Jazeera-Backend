/**
 * Public card tokens — 12 random base62 characters (~71 bits of entropy), so
 * the URL is /c/k7Fq2mXp9wZa, unguessable and never derived from a name. The
 * card model's unique index is the final backstop against the (astronomically
 * unlikely) collision.
 */
import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const TOKEN_LENGTH = 12;

export function generateToken(length = TOKEN_LENGTH) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Generate `count` distinct tokens (in-set uniqueness; DB index guards the rest). */
export function generateTokens(count) {
  const tokens = new Set();
  while (tokens.size < count) tokens.add(generateToken());
  return [...tokens];
}
