/**
 * Building DCQL queries for the Swiss Profile.
 *
 * The profile narrows OID4VP's query language considerably: only `dc+sd-jwt`,
 * only one credential per query (`multiple` is not supported), and a
 * DID-based trusted-authorities query in place of the ones in the base spec.
 * These helpers make the narrow path the easy one.
 */

import type { CredentialDefinition } from './credential-definition.js';
import { CREDENTIAL_FORMAT, PROTECTED_CLAIMS } from './profile.js';
import type { DcqlClaim, DcqlCredential, DcqlQuery } from './types.js';

export interface CredentialQueryOptions {
  /** DCQL query id; also the key the disclosed claims come back under. */
  id: string;
  /** Credential type to ask for. */
  definition: CredentialDefinition;
  /** Claim names (or claim paths) to request. Ask for the minimum. */
  claims: (string | (string | number | null)[])[];
  /**
   * Issuer DIDs accepted for this credential. Prefer stating them here over
   * accepting anything: `accepted_issuer_dids` is evaluated before trust
   * anchors and is the tightest control a verifier has.
   */
  acceptedIssuerDids?: string[];
  /**
   * Set only when this verifier holds an authorization for the protected
   * claims it is requesting. Requesting a protected field without one is
   * something an ecosystem actor is expected to refuse, so it has to be
   * deliberate rather than accidental.
   */
  protectedClaimsAuthorized?: boolean;
}

export class ProtectedClaimError extends Error {
  constructor(readonly claims: string[]) {
    super(
      `refusing to request protected claim(s) ${claims.join(', ')}: swiss-profile-trust 1.0 ` +
        'requires a Governed Use Case Authorization Trust Marker for these fields. ' +
        'Set protectedClaimsAuthorized once the verifier actually holds one.',
    );
    this.name = 'ProtectedClaimError';
  }
}

/** Build one credential query, validating it against the profile's narrowing. */
export function credentialQuery(options: CredentialQueryOptions): DcqlCredential {
  const paths: (string | number | null)[][] = options.claims.map((claim) =>
    Array.isArray(claim) ? claim : [claim],
  );

  const known = new Set(options.definition.claims.map((c) => c.name));
  const unknown = paths
    .map((path) => path[0])
    .filter((root): root is string => typeof root === 'string' && !known.has(root));
  if (unknown.length > 0) {
    throw new Error(
      `${options.definition.vct} has no claim(s) ${unknown.join(', ')}; ` +
        `available: ${[...known].join(', ')}`,
    );
  }

  const requestedProtected = paths
    .map((path) => path[0])
    .filter((root): root is string => typeof root === 'string' && PROTECTED_CLAIMS.includes(root));
  if (requestedProtected.length > 0 && !options.protectedClaimsAuthorized) {
    throw new ProtectedClaimError([...new Set(requestedProtected)]);
  }

  const claims: DcqlClaim[] = paths.map((path) => ({ path }));

  return {
    id: options.id,
    format: CREDENTIAL_FORMAT,
    meta: { vct_values: [options.definition.vct] },
    claims,
    // Every credential type in this project is key-bound; presenting one
    // without proof of possession would defeat the point.
    require_cryptographic_holder_binding: true,
    ...(options.acceptedIssuerDids && options.acceptedIssuerDids.length > 0
      ? { trusted_authorities: [{ type: 'did' as const, values: options.acceptedIssuerDids }] }
      : {}),
  };
}

/** Assemble a DCQL query from one or more credential queries. */
export function dcqlQuery(...credentials: DcqlCredential[]): DcqlQuery {
  if (credentials.length === 0) {
    throw new Error('a DCQL query needs at least one credential query');
  }
  const ids = credentials.map((c) => c.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    throw new Error(`duplicate DCQL credential query id(s): ${[...new Set(duplicates)].join(', ')}`);
  }
  return { credentials };
}

/**
 * Read the claims a wallet disclosed for one credential query.
 * Returns `undefined` when the query was not answered.
 */
export function disclosedClaims(
  response: { wallet_response?: { credential_subject_data?: Record<string, unknown> } } | undefined,
  queryId: string,
): Record<string, unknown> | undefined {
  const data = response?.wallet_response?.credential_subject_data;
  if (!data) return undefined;
  const claims = data[queryId];
  return claims && typeof claims === 'object' ? (claims as Record<string, unknown>) : undefined;
}
