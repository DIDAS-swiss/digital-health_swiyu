/**
 * Conformance checks against the swiyu Swiss Profiles version 1.0.
 *
 * The generic components enforce the profile at the protocol edge, but a
 * business application can still hand them a request the profile forbids — a
 * cleartext `direct_post` response mode, a batch size below the privacy floor,
 * an issuer metadata document with encryption switched off. These checks run in
 * our own tests and at start-up, so such a mistake surfaces here rather than as
 * a wallet that silently refuses to connect.
 *
 * Each finding quotes the rule it comes from, so a failure is actionable
 * without opening the specification.
 */

import { CREDENTIAL_FORMAT, CRYPTO, LIMITS, PROFILE_VERSION } from './profile.js';
import type { CreateVerificationRequest, DcqlCredential } from './types.js';

export interface Finding {
  /** Specification section the rule comes from. */
  rule: string;
  message: string;
}

export class ConformanceError extends Error {
  constructor(
    readonly findings: Finding[],
    subject: string,
  ) {
    super(
      `${subject} violates the Swiss Profile:\n` +
        findings.map((f) => `  - [${f.rule}] ${f.message}`).join('\n'),
    );
    this.name = 'ConformanceError';
  }
}

function assertNoFindings(findings: Finding[], subject: string): void {
  if (findings.length > 0) throw new ConformanceError(findings, subject);
}

/* ------------------------------------------------------ issuer metadata */

export function checkIssuerMetadata(metadata: Record<string, unknown>): Finding[] {
  const findings: Finding[] = [];
  const add = (rule: string, message: string) => findings.push({ rule, message });

  if (metadata.profile_version !== PROFILE_VERSION.issuance) {
    add(
      'swiss-profile-issuance §12.2.4',
      `profile_version must be "${PROFILE_VERSION.issuance}", found ${JSON.stringify(metadata.profile_version)}`,
    );
  }
  if (typeof metadata.nonce_endpoint !== 'string') {
    add('swiss-profile-issuance §12.2.4', 'nonce_endpoint is REQUIRED (the wallet fetches DPoP nonces there)');
  }
  if ('authorization_servers' in metadata) {
    add('swiss-profile-issuance §12.2.4', 'authorization_servers is NOT SUPPORTED');
  }
  if ('notification_endpoint' in metadata) {
    add('swiss-profile-issuance §12.2.4', 'notification_endpoint is NOT SUPPORTED');
  }

  for (const direction of ['credential_request_encryption', 'credential_response_encryption'] as const) {
    const encryption = metadata[direction] as { encryption_required?: unknown } | undefined;
    if (!encryption) {
      add('swiss-profile-issuance §12.2.4', `${direction} is REQUIRED`);
    } else if (encryption.encryption_required !== true) {
      add('swiss-profile-issuance §12.2.4', `${direction}.encryption_required MUST be true`);
    }
  }

  const batch = metadata.batch_credential_issuance as { batch_size?: unknown } | undefined;
  if (batch && typeof batch.batch_size === 'number' && batch.batch_size < LIMITS.minBatchSize) {
    add(
      'swiss-profile-issuance §14.A',
      `batch_size must be at least ${LIMITS.minBatchSize} to protect holder privacy, found ${batch.batch_size}`,
    );
  }

  for (const display of asArray(metadata.display)) {
    const logo = (display as { logo?: { uri?: unknown } }).logo;
    if (logo?.uri !== undefined && !isImageDataUrl(logo.uri)) {
      add(
        'swiss-profile-issuance §12.2.4',
        'display.logo.uri MUST be a base64 data URL with MIME type image/png or image/jpeg',
      );
    }
  }

  const configurations = metadata.credential_configurations_supported as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!configurations || Object.keys(configurations).length === 0) {
    add('swiss-profile-issuance §12.2.4', 'credential_configurations_supported is REQUIRED');
  } else {
    for (const [id, configuration] of Object.entries(configurations)) {
      findings.push(...checkCredentialConfiguration(id, configuration));
    }
  }
  return findings;
}

function checkCredentialConfiguration(id: string, configuration: Record<string, unknown>): Finding[] {
  const findings: Finding[] = [];
  const add = (rule: string, message: string) =>
    findings.push({ rule, message: `credential_configurations_supported.${id}: ${message}` });

  if (configuration.format !== CREDENTIAL_FORMAT) {
    add(
      'swiss-profile-issuance §3.3.1',
      `format must be "${CREDENTIAL_FORMAT}" — ISO mdoc and W3C VCDM are NOT SUPPORTED`,
    );
  }
  if ('scope' in configuration) {
    add('swiss-profile-issuance §12.2.4', 'scope is NOT SUPPORTED');
  }
  const binding = asArray(configuration.cryptographic_binding_methods_supported);
  if (binding.length > 0 && !binding.every((method) => method === 'jwk')) {
    add('swiss-profile-issuance §12.2.4', 'cryptographic_binding_methods_supported MUST be jwk');
  }
  const proofTypes = configuration.proof_types_supported as Record<string, unknown> | undefined;
  if (proofTypes && !('jwt' in proofTypes)) {
    add('swiss-profile-issuance §12.2.4', 'proof_types_supported MUST be jwt');
  }
  for (const algorithm of asArray(configuration.credential_signing_alg_values_supported)) {
    if (algorithm !== CRYPTO.jwsAlg) {
      add(
        'swiss-profile-issuance, Cryptography',
        `credential_signing_alg_values_supported contains ${String(algorithm)}; the profile allows only ${CRYPTO.jwsAlg}`,
      );
    }
  }
  const metadata = configuration.credential_metadata as Record<string, unknown> | undefined;
  for (const claim of asArray(metadata?.claims)) {
    if (claim && typeof claim === 'object' && 'mandatory' in claim) {
      add('swiss-profile-issuance §12.2.4', 'credential_metadata.claims[].mandatory is NOT SUPPORTED');
    }
  }
  for (const display of asArray(metadata?.display)) {
    const record = display as Record<string, unknown>;
    if ('background_image' in record) {
      add('swiss-profile-issuance §12.2.4', 'credential_metadata.display[].background_image is NOT SUPPORTED');
    }
    if ('text_color' in record) {
      add('swiss-profile-issuance §12.2.4', 'credential_metadata.display[].text_color is NOT SUPPORTED');
    }
  }
  return findings;
}

export function assertIssuerMetadata(metadata: Record<string, unknown>): void {
  assertNoFindings(checkIssuerMetadata(metadata), 'issuer metadata');
}

/* ------------------------------------------------- verification request */

export function checkVerificationRequest(request: CreateVerificationRequest): Finding[] {
  const findings: Finding[] = [];
  const add = (rule: string, message: string) => findings.push({ rule, message });

  if (request.jwt_secured_authorization_request !== true) {
    add(
      'swiss-profile-verification §5',
      'verifiers MUST send the authorization request as a signed JAR; set jwt_secured_authorization_request: true',
    );
  }
  if (request.response_mode !== 'direct_post.jwt') {
    add(
      'swiss-profile-verification §5.2 / §8',
      `response_mode MUST be "direct_post.jwt" — the presentation response is always encrypted; found ${JSON.stringify(request.response_mode)}`,
    );
  }
  if (!request.dcql_query || request.dcql_query.credentials.length === 0) {
    add('OID4VP §6', 'dcql_query.credentials must contain at least one credential query');
  } else {
    for (const credential of request.dcql_query.credentials) {
      findings.push(...checkCredentialQuery(credential));
    }
  }
  if (
    (!request.accepted_issuer_dids || request.accepted_issuer_dids.length === 0) &&
    (!request.trust_anchors || request.trust_anchors.length === 0)
  ) {
    add(
      'swiss-profile-trust 1.0, Trust requirements',
      'neither accepted_issuer_dids nor trust_anchors is set, so every issuer DID would be accepted; ' +
        'an actor MUST be able to evaluate the trust markers of its counterparty',
    );
  }
  const purpose = request.verification_purpose;
  if (purpose) {
    for (const field of ['purpose_name', 'purpose_description'] as const) {
      const value = purpose[field];
      if (!value?.default || value.default.trim() === '') {
        add('swiyu-verifier management API', `verification_purpose.${field} must contain a non-blank "default" entry`);
      }
    }
    const nameLimit = 50;
    const descriptionLimit = 500;
    for (const [locale, text] of Object.entries(purpose.purpose_name ?? {})) {
      if (text.length > nameLimit) {
        add('swiyu-verifier management API', `verification_purpose.purpose_name[${locale}] exceeds ${nameLimit} characters`);
      }
    }
    for (const [locale, text] of Object.entries(purpose.purpose_description ?? {})) {
      if (text.length > descriptionLimit) {
        add(
          'swiyu-verifier management API',
          `verification_purpose.purpose_description[${locale}] exceeds ${descriptionLimit} characters`,
        );
      }
    }
  }
  return findings;
}

function checkCredentialQuery(credential: DcqlCredential): Finding[] {
  const findings: Finding[] = [];
  const add = (rule: string, message: string) =>
    findings.push({ rule, message: `dcql_query.credentials[${credential.id}]: ${message}` });

  if (credential.format !== CREDENTIAL_FORMAT) {
    add('swiss-profile-verification §7.2', `format must be "${CREDENTIAL_FORMAT}"; ISO mdoc is NOT SUPPORTED`);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(credential.id)) {
    add('OID4VP §6.1', 'id must match ^[a-zA-Z0-9_-]+$');
  }
  if ('multiple' in credential) {
    add('swiss-profile-verification §6.1', 'multiple is NOT SUPPORTED — only a single credential per verification');
  }
  for (const authority of credential.trusted_authorities ?? []) {
    if (authority.type !== 'did') {
      add(
        'swiss-profile-verification §6.1.1',
        `trusted_authorities type must be "did"; ${String(authority.type)} does not apply in the swiyu trust infrastructure`,
      );
    }
  }
  if (credential.claims && credential.claims.length === 0) {
    add('OID4VP §6.1', 'claims must be a non-empty array when present');
  }
  return findings;
}

export function assertVerificationRequest(request: CreateVerificationRequest): void {
  assertNoFindings(checkVerificationRequest(request), 'verification request');
}

/* ------------------------------------------------------------ OCA bundle */

/** Overlay types the Swiss Profile requires wallets to support. */
const SUPPORTED_OVERLAYS = new Set([
  'spec/overlays/character_encoding/1.0',
  'spec/overlays/format/1.0',
  'spec/overlays/standard/1.0',
  'spec/overlays/meta/1.0',
  'spec/overlays/entry/1.0',
  'spec/overlays/entry_code/1.0',
  'spec/overlays/sensitive/1.0',
  'spec/overlays/label/1.1',
  'extend/overlays/data_source/2.0',
  'extend/overlays/order/1.0',
  'aries/overlays/branding/1.1',
]);

export function checkOcaBundle(bundle: Record<string, unknown>): Finding[] {
  const findings: Finding[] = [];
  const add = (rule: string, message: string) => findings.push({ rule, message });

  if (bundle.profile_version !== PROFILE_VERSION.vc) {
    add('swiss-profile-vc, OCA Bundle as JSON file', `profile_version must be "${PROFILE_VERSION.vc}"`);
  }

  const captureBases = asArray(bundle.capture_bases) as Record<string, unknown>[];
  if (captureBases.length === 0) {
    add('OCA 1.0', 'capture_bases must contain at least one Capture Base');
  }

  const digests = new Set(captureBases.map((base) => String(base.digest)));
  const referenced = new Set<string>();
  for (const base of captureBases) {
    if ('classification' in base) {
      add('swiss-profile-vc, Capture Base', 'attribute classification is NOT SUPPORTED');
    }
    if ('flagged_attributes' in base) {
      add('swiss-profile-vc, Capture Base', 'flagged_attributes is NOT SUPPORTED — use the Sensitive Overlay');
    }
    for (const type of Object.values((base.attributes ?? {}) as Record<string, string>)) {
      const reference = /^refs:(.+)$/.exec(type);
      if (!reference?.[1]) continue;
      referenced.add(reference[1]);
      if (!digests.has(reference[1])) {
        add('OCA 1.0', `attribute references unknown Capture Base ${reference[1]}`);
      }
    }
  }

  const roots = [...digests].filter((digest) => !referenced.has(digest));
  if (roots.length !== 1) {
    add(
      'swiss-profile-vc, OCA Bundle as JSON file',
      `there MUST be exactly one root Capture Base, found ${roots.length}`,
    );
  }

  for (const overlay of asArray(bundle.overlays) as Record<string, unknown>[]) {
    const type = String(overlay.type);
    if (!SUPPORTED_OVERLAYS.has(type)) {
      add('swiss-profile-vc, Overlays', `overlay type ${type} is outside the profile's supported set`);
    }
    if (typeof overlay.capture_base !== 'string' || !digests.has(overlay.capture_base)) {
      add('OCA 1.0', `overlay ${type} references a Capture Base that is not in the bundle`);
    }
    if (type === 'aries/overlays/branding/1.1') {
      const logo = overlay.logo;
      if (logo !== undefined && !isImageDataUrl(logo)) {
        add(
          'swiss-profile-vc, Branding Overlay',
          'the Branding Overlay MUST only use embedded media in the form of data URLs',
        );
      }
    }
  }
  return findings;
}

export function assertOcaBundle(bundle: Record<string, unknown>): void {
  assertNoFindings(checkOcaBundle(bundle), 'OCA bundle');
}

/* ------------------------------------------------------------- helpers */

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isImageDataUrl(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    (value.startsWith('data:image/png;base64,') || value.startsWith('data:image/jpeg;base64,'))
  );
}
