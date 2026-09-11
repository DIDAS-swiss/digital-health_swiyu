/**
 * Subresource Integrity strings, used by `vct_metadata_uri#integrity`,
 * `schema_uri#integrity` and the OCA `uri#integrity` properties so a wallet can
 * detect a swapped-out metadata document.
 */

import { createHash } from 'node:crypto';

/** Produce a `sha256-<base64>` integrity string for a document's exact bytes. */
export function integrity(content: string | Buffer): string {
  const digest = createHash('sha256').update(content).digest('base64');
  return `sha256-${digest}`;
}

/** Check a document against an integrity string. Returns false on any mismatch. */
export function verifyIntegrity(content: string | Buffer, expected: string): boolean {
  const [algorithm, value] = expected.split('-', 2);
  if (algorithm !== 'sha256' || !value) return false;
  return createHash('sha256').update(content).digest('base64') === value;
}
