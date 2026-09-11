/**
 * Browser-safe entry point.
 *
 * Everything that decides something at runtime — the governance engine, the
 * DCQL builder, the conformance checks, the projections, the credential
 * definitions — runs anywhere. Only the *generators* need Node, because they
 * compute CESR and SRI digests with `node:crypto`, and those run at build time
 * against files on disk.
 *
 * This entry exists so a browser demo can exercise the real decision code
 * rather than a reimplementation of it. A demo that reimplements the rules it
 * is demonstrating proves nothing about the rules.
 *
 * Deliberately excluded: `credential-definition.js` (the generators),
 * `cesr.js`, `sri.js`, and the management API clients, which have no business
 * being called from a page.
 */

export * from './profile.js';
export * from './types.js';
export * from './dcql.js';
export * from './governance.js';
export * from './projections.js';
export * from './conformance.js';
export * from './credentials/index.js';

// The definition model is exported as types only: the builders that turn a
// definition into metadata stay on the Node side.
export type {
  ClaimDefinition,
  CredentialDefinition,
  CredentialGovernance,
  Locale,
  Localized,
  OcaAttributeType,
  SemanticBinding,
  VerifierEntitlement,
} from './credential-definition.js';
