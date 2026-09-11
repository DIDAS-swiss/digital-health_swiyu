/**
 * Constants pinned to the swiyu Swiss Profiles version 1.0, as published on
 * https://swiyu-admin-ch.github.io/specifications/ and enforced by the swiyu
 * Sandbox (the environment formerly called "Public Beta", renamed by change
 * dossier CD-001 and separated from production).
 *
 * Every value here is a *specification* value. If the profile
 * moves, this file is the single place that changes.
 */

/** `profile_version` values required in JOSE headers / JSON bodies. */
export const PROFILE_VERSION = {
  /** swiss-profile-anchor 1.0 — DID Core + did:webvh. Goes into DID log entries. */
  anchor: 'swiss-profile-anchor:1.0.0',
  /** swiss-profile-issuance 1.0 — OID4VCI 1.0 + DPoP. Goes into issuer metadata, DPoP, key attestations. */
  issuance: 'swiss-profile-issuance:1.0.0',
  /** swiss-profile-verification 1.0 — OID4VP 1.0 + JAR. Goes into the JAR header. */
  verification: 'swiss-profile-verification:1.0.0',
  /** swiss-profile-vc 1.0 — SD-JWT VC, Token Status List, OCA. Goes into VCT metadata, OCA bundles, SD-JWT headers. */
  vc: 'swiss-profile-vc:1.0.0',
} as const;

/**
 * Cryptography. All three profiles narrow the algorithm set to exactly one
 * signature algorithm; anything else MUST be rejected.
 */
export const CRYPTO = {
  /** swiss-profile-{issuance,verification,vc,anchor}: "JWS algorithm MUST be ES256". */
  jwsAlg: 'ES256',
  /** swiss-profile-vc: "Hash function MUST be sha-256". */
  hashAlg: 'sha-256',
  /** Key agreement for application-layer encryption. */
  encAlg: 'ECDH-ES',
  /** Content encryption. Issuance/verification use A256GCM, the VC profile A128GCM. */
  encValuesSupported: ['A128GCM', 'A256GCM'],
  /** The only curve in the profile. */
  crv: 'P-256',
} as const;

/** Credential format identifier. ISO mdoc and W3C VCDM are NOT SUPPORTED by the Swiss Profile. */
export const CREDENTIAL_FORMAT = 'dc+sd-jwt' as const;

/** Media type of an SD-JWT VC (swiss-profile-vc, referencing SD-JWT VC §3.1). */
export const SD_JWT_VC_MEDIA_TYPE = 'application/dc+sd-jwt' as const;

/** JOSE `typ` values fixed by the profiles. */
export const JOSE_TYP = {
  sdJwtVc: 'dc+sd-jwt',
  statusList: 'statuslist+jwt',
  dpop: 'dpop+jwt',
  keyAttestation: 'key-attestation+jwt',
  issuerMetadata: 'openidvci-issuer-metadata+jwt',
  authzRequest: 'oauth-authz-req+jwt',
} as const;

/** Wallet invocation schemes. Wallets MUST support both members of each pair. */
export const DEEPLINK_SCHEME = {
  issuance: ['openid-credential-offer://', 'swiyu://'],
  verification: ['openid4vp://', 'swiyu-verify://'],
} as const;

/**
 * Token Status List status values accepted by the Swiss Profile.
 * Everything else is technically valid but renders as "UNKNOWN" in the wallet.
 */
export const TOKEN_STATUS = {
  VALID: 0x00,
  INVALID: 0x01,
  SUSPENDED: 0x02,
} as const;

/**
 * Base URLs of the swiyu **Sandbox** trust infrastructure.
 *
 * Note the `swiyu-int` host segment: these are the integration/sandbox hosts.
 * Production (go-live 2026) uses the equivalent `swiyu` hosts, and CD-001
 * forbids mixing the two — the swiyu Wallet talks only to production, the
 * swiyu Sandbox Wallet only to these.
 */
export const SANDBOX = {
  basePortal: 'https://portal.trust-infra.swiyu-int.admin.ch',
  identifierRegistryApi: 'https://identifier-reg-api.trust-infra.swiyu-int.admin.ch',
  trustRegistry: 'https://trust-reg.trust-infra.swiyu-int.admin.ch',
  trustRegistryApi: 'https://trust-reg-api.trust-infra.swiyu-int.admin.ch',
  statusRegistryApi: 'https://status-reg-api.trust-infra.swiyu-int.admin.ch',
  apiSelfService: 'https://selfservice.api.admin.ch/api-selfservice/apis',
  betaCredentialService: 'https://www.bcs.admin.ch/bcs-web',
} as const;

/**
 * Root trust anchors of the Sandbox, from swiss-profile-trust 1.0.
 * Used as `trust_anchors` when a verification should accept any issuer that
 * carries a trust statement from the anchor, which a hard-coded DID list would
 * have to be maintained by hand.
 */
export const SANDBOX_TRUST_ANCHOR = {
  trustStatementIssuer:
    'did:webvh:QmdVPcfEJgvQAJKEjaTWAhskT1kc59KZQiXNenqHBB7iH5:identifier-reg.trust-infra.swiyu-int.admin.ch:api:v1:did:4c131dc4-ced1-454b-bbd4-9401c7512e37',
  publicTransparencyStatementIssuer:
    'did:webvh:QmNTHuhETA3u2ypoujoaEMaZGKf5HpPwkV6ktfgzu7JzMp:identifier-reg.trust-infra.swiyu-int.admin.ch:api:v1:did:5e5de412-0e7d-4982-a0ed-bd55a0f25a04',
} as const;

/**
 * The Beta-ID: the Sandbox stand-in for the e-ID, carrying the attribute set of
 * Art. 15 BGEID. Issued by the Beta Credential Service, never by us.
 */
export const BETA_ID = {
  vct: 'betaid-sdjwt',
  issuerDid:
    'did:tdw:QmPEZPhDFR4nEYSFK5bMnvECqdpf1tPTPJuWs9QrMjCumw:identifier-reg.trust-infra.swiyu-int.admin.ch:api:v1:did:9a5559f0-b81c-4368-a170-e7b4ae424527',
} as const;

/**
 * Claims that swiss-profile-trust 1.0 marks as **protected fields**: a verifier
 * needs an explicit authorization trust marker to request them, regardless of
 * which credential type carries them.
 */
export const PROTECTED_CLAIMS: readonly string[] = ['personal_administrative_number'];

/**
 * Size limits the Sandbox enforces.
 * - Status list token: > 200 bytes and <= 200 KB, decompressed also <= 200 KB.
 * - Credential response batch payload: 20 MB (swiyu Wallet).
 * - Authorization response: 21 MB — the VC limit plus 1 MB.
 */
export const LIMITS = {
  statusListTokenMinBytes: 200,
  statusListTokenMaxBytes: 200 * 1024,
  /** ~100'000 entries at 2 bits per status. */
  statusListMaxEntries: 100_000,
  credentialBatchPayloadBytes: 20 * 1024 * 1024,
  authorizationResponseBytes: 21 * 1024 * 1024,
  /** swiss-profile-issuance §12.2.4: batch_size MUST be at least 10. */
  minBatchSize: 10,
} as const;
