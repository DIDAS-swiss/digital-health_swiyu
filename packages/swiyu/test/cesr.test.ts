import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  canonicalize,
  CESR_SHA256_LENGTH,
  cesrEncodeSha256,
  DIGEST_PLACEHOLDER,
  integrity,
  verifyIntegrity,
  withCesrDigest,
} from '../src/index.js';

describe('JSON canonicalisation', () => {
  it('sorts object keys by code unit', () => {
    expect(canonicalize({ b: 1, a: 2, C: 3 })).toBe('{"C":3,"a":2,"b":1}');
  });

  it('preserves array order', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]');
  });

  it('drops undefined members, which JSON has no representation for', () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('escapes strings as JSON does', () => {
    expect(canonicalize({ a: 'x"y\n' })).toBe('{"a":"x\\"y\\n"}');
  });

  it('refuses values JSON cannot represent', () => {
    expect(() => canonicalize({ a: Number.NaN })).toThrow(TypeError);
  });
});

describe('CESR SHA-256 digests', () => {
  it('produces a 44-character digest starting with the SHA-256 code', () => {
    const digest = cesrEncodeSha256(createHash('sha256').update('hello').digest());
    expect(digest).toHaveLength(CESR_SHA256_LENGTH);
    expect(digest.startsWith('I')).toBe(true);
    expect(digest).not.toContain('=');
  });

  it('rejects a digest of the wrong length', () => {
    expect(() => cesrEncodeSha256(Buffer.alloc(16))).toThrow(RangeError);
  });

  it('is self-addressing: the digest covers the object with a placeholder in its place', () => {
    const object = { type: 'spec/capture_base/1.0', attributes: { a: 'Text' } };
    const withDigest = withCesrDigest(object);
    const expected = cesrEncodeSha256(
      createHash('sha256')
        .update(canonicalize({ ...object, digest: DIGEST_PLACEHOLDER }), 'utf8')
        .digest(),
    );
    expect(withDigest.digest).toBe(expected);
  });

  it('is stable across key ordering, because the payload is canonicalised', () => {
    const a = withCesrDigest({ type: 'x', attributes: { one: 'Text', two: 'Numeric' } });
    const b = withCesrDigest({ attributes: { two: 'Numeric', one: 'Text' }, type: 'x' });
    expect(a.digest).toBe(b.digest);
  });

  it('changes when the content changes', () => {
    const a = withCesrDigest({ attributes: { one: 'Text' } });
    const b = withCesrDigest({ attributes: { one: 'Numeric' } });
    expect(a.digest).not.toBe(b.digest);
  });
});

describe('subresource integrity', () => {
  it('round-trips', () => {
    const document = '{"vct":"urn:vct:example"}';
    expect(verifyIntegrity(document, integrity(document))).toBe(true);
  });

  it('fails on a single changed byte', () => {
    expect(verifyIntegrity('{"a":1}', integrity('{"a":2}'))).toBe(false);
  });

  it('rejects an unsupported algorithm rather than accepting it', () => {
    expect(verifyIntegrity('x', 'sha512-abc')).toBe(false);
  });
});
