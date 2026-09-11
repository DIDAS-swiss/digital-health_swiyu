/**
 * CESR SHA-256 digests and JSON canonicalisation, as required for OCA bundles.
 *
 * OCA identifies every Capture Base by a self-addressing digest: the digest is
 * computed over the object *with the digest field replaced by placeholder
 * characters of the same length*, then written back into that field. The
 * encoding is CESR — see the swiyu OCA 1.0 specification,
 * "CESR encoding".
 */

import { createHash } from 'node:crypto';

/** CESR algorithm code for SHA-256 ("Blake3-256" would be `E`, SHA-256 is `I`). */
const SHA256_CODE = 'I';

/**
 * Length of a CESR SHA-256 digest in characters: a 32-byte digest plus one lead
 * byte is 33 bytes, which base64url-encodes to exactly 44 unpadded characters.
 */
export const CESR_SHA256_LENGTH = 44;

/** The placeholder written into `digest` while the digest is being computed. */
export const DIGEST_PLACEHOLDER = '#'.repeat(CESR_SHA256_LENGTH);

/**
 * RFC 8785 JSON Canonicalisation Scheme, restricted to what OCA bundles
 * contain: objects, arrays, strings, finite numbers, booleans and null.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) {
        throw new TypeError('JCS cannot serialise NaN or Infinity');
      }
      // Integers and the doubles OCA uses round-trip correctly through
      // JSON.stringify, which already emits the shortest ES6 representation.
      return JSON.stringify(value);
    case 'string':
      return JSON.stringify(value);
    case 'object':
      break;
    default:
      throw new TypeError(`JCS cannot serialise a ${typeof value}`);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    // JCS sorts by UTF-16 code unit, which is what Array#sort does by default.
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',')}}`;
}

/** CESR-encode a raw 32-byte SHA-256 digest. */
export function cesrEncodeSha256(digest: Buffer): string {
  if (digest.length !== 32) {
    throw new RangeError(`expected a 32-byte SHA-256 digest, got ${digest.length}`);
  }
  // One lead byte makes 33 bytes, divisible by both 8 and 6 bits, so base64url
  // emits 44 characters with no padding.
  const padded = Buffer.concat([Buffer.from([0x00]), digest]);
  const b64 = padded.toString('base64url');
  // The lead byte's first 6 bits become a leading 'A', which the algorithm code
  // replaces — that is what keeps the result 44 characters long.
  return SHA256_CODE + b64.slice(1);
}

/**
 * Compute the self-addressing digest of an OCA object and return a copy with
 * `digest` filled in.
 */
export function withCesrDigest<T extends object>(object: T): T & { digest: string } {
  const placeheld = { ...object, digest: DIGEST_PLACEHOLDER };
  const hash = createHash('sha256').update(canonicalize(placeheld), 'utf8').digest();
  return { ...object, digest: cesrEncodeSha256(hash) } as T & { digest: string };
}
