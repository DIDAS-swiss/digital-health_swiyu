/**
 * Wire types for the management APIs of the swiyu generic components
 * (`swiyu-issuer` and `swiyu-verifier`), transcribed from their published
 * `openapi.yaml`. These are the *business* APIs: the OID4VCI / OID4VP endpoints
 * that face the wallet are implemented by the generic components themselves and
 * are deliberately not modelled here.
 */

import type { CREDENTIAL_FORMAT } from './profile.js';

/* ------------------------------------------------------------------ issuer */

/** `POST /management/api/status-list` */
export interface StatusListCreateRequest {
  /** How many referenced tokens fit on the list. */
  maxLength: number;
  config: {
    /** Bits per referenced token. 1 = revocation only, 2 = revocation + suspension. */
    bits: 1 | 2 | 4 | 8;
    purpose?: string;
  };
  configuration_override?: ConfigurationOverride;
}

/** Response of status-list create/read. */
export interface StatusList {
  id: string;
  /** URI the registry serves the status list token at; goes into credential offers. */
  statusRegistryUrl: string;
  maxListEntries: number;
  remainingListEntries: number;
  config: Record<string, unknown>;
}

export interface ConfigurationOverride {
  [key: string]: unknown;
}

/** `POST /management/api/credentials` */
export interface CreateCredentialOfferRequest {
  /** Keys into `credential_configurations_supported` of the issuer metadata. */
  metadata_credential_supported_id: string[];
  /** The claims written into the SD-JWT VC. All of them become disclosures. */
  credential_subject_data: Record<string, unknown>;
  credential_metadata?: { deferred?: boolean; [key: string]: unknown };
  offer_validity_seconds?: number;
  deferred_offer_validity_seconds?: number;
  /** `exp` of the VC. Once reached the credential cannot be presented at all. */
  credential_valid_until?: string;
  /** `nbf` of the VC. */
  credential_valid_from?: string;
  /** `statusRegistryUrl` values of previously initialised status lists. */
  status_lists?: string[];
  configuration_override?: ConfigurationOverride;
}

export interface CredentialWithDeeplinkResponse {
  management_id: string;
  offer_id?: string;
  /** `swiyu://...` / `openid-credential-offer://...` deeplink for the QR code. */
  offer_deeplink: string;
}

/**
 * Lifecycle of a credential offer and the credential issued from it.
 * `REVOKED` is terminal; `SUSPENDED` can be lifted by going back to `ISSUED`.
 */
export type CredentialStatusType =
  | 'INIT'
  | 'OFFERED'
  | 'CANCELLED'
  | 'IN_PROGRESS'
  | 'DEFERRED'
  | 'READY'
  | 'ISSUED'
  | 'SUSPENDED'
  | 'REVOKED'
  | 'REQUESTED'
  | 'EXPIRED';

/** The subset a business issuer is allowed to set. */
export type UpdateCredentialStatusRequestType =
  | 'CANCELLED'
  | 'READY'
  | 'ISSUED'
  | 'SUSPENDED'
  | 'REVOKED';

export interface UpdateStatusResponse {
  id: string;
  status: CredentialStatusType;
  status_lists?: string[];
}

export interface IssuerWebhookCallback {
  subject_id: string;
  event_type: 'VC_STATUS_CHANGED' | 'VC_DEFERRED' | 'ISSUANCE_ERROR';
  event?: string;
  event_description?: string;
  event_trigger?: 'CREDENTIAL_MANAGEMENT' | 'CREDENTIAL_OFFER';
  timestamp?: string;
}

/* ---------------------------------------------------------------- verifier */

/** OID4VP §6: Digital Credentials Query Language. */
export interface DcqlQuery {
  credentials: DcqlCredential[];
  credential_sets?: DcqlCredentialSet[];
}

export interface DcqlCredential {
  /** `^[a-zA-Z0-9_-]+$`; keys the presented claims in the verification result. */
  id: string;
  format: typeof CREDENTIAL_FORMAT;
  meta?: { vct_values?: string[] };
  claims?: DcqlClaim[];
  /**
   * Defaults to true. The Swiss Profile only issues key-bound credentials for
   * these use cases, so leaving it true is what you want.
   */
  require_cryptographic_holder_binding?: boolean;
  /** Swiss Profile: `multiple` is NOT SUPPORTED — one credential per query. */
  trusted_authorities?: DidTrustedAuthority[];
}

/**
 * swiss-profile-verification §6.1.1 replaces the spec's trusted-authority types
 * with a single DID-based one.
 */
export interface DidTrustedAuthority {
  type: 'did';
  values: string[];
}

export interface DcqlClaim {
  id?: string;
  /** Claims path pointer, e.g. `['medication', 0, 'name']`. */
  path: (string | number | null)[];
  values?: (string | number | boolean)[];
}

export interface DcqlCredentialSet {
  options: string[][];
  required?: boolean;
  purpose?: unknown;
}

/** `POST /management/api/verifications` */
export interface CreateVerificationRequest {
  /** Exact issuer DIDs to accept. Evaluated before `trust_anchors`. */
  accepted_issuer_dids?: string[];
  /** Accept anything the anchor has issued a trust statement for. */
  trust_anchors?: TrustAnchor[];
  /** Swiss Profile: verifiers MUST send the request object as a signed JAR. */
  jwt_secured_authorization_request?: boolean;
  /** Swiss Profile: MUST be `direct_post.jwt` — the response is always encrypted. */
  response_mode?: 'direct_post' | 'direct_post.jwt';
  dcql_query: DcqlQuery;
  /** Transparency metadata registered at the Trust Management Service. */
  verification_purpose?: VerificationPurpose;
  configuration_override?: ConfigurationOverride;
  redirect_uri?: string;
}

export interface TrustAnchor {
  did: string;
  /** Must be an https URI; the trust statement is looked up under /api/v1/truststatements/{did}. */
  trust_registry_uri: string;
}

export interface VerificationPurpose {
  /** Stable scope identifier, e.g. `ch.didas.health.checkin`. */
  scope: string;
  /** Localised, `default` key required, <= 50 chars per value. */
  purpose_name: Record<string, string>;
  /** Localised, `default` key required, <= 500 chars per value. */
  purpose_description: Record<string, string>;
}

export type VerificationStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface VerificationManagementResponse {
  id: string;
  request_nonce?: string;
  state: VerificationStatus;
  dcql_query?: DcqlQuery;
  /** Keyed by the DCQL credential query id. */
  credential_evaluation?: Record<string, CredentialEvaluation[]>;
  wallet_response?: WalletResponse;
  verification_url?: string;
  /** `swiyu-verify://...` / `openid4vp://...` deeplink for the QR code. */
  verification_deeplink?: string;
}

export interface CredentialEvaluation {
  credential_status?: { valid: boolean; status: number };
  trust_markers?: IssuerTrustMarker;
  valid?: boolean;
}

/** Trust Protocol 2.0 markers, as evaluated by the generic verifier. */
export interface IssuerTrustMarker {
  trust_method?: 'TRUST_PROTOCOL_1_0' | 'TRUST_PROTOCOL_2_0' | 'TRUSTED_AUTHORITY';
  /** Overall verdict. */
  is_trusted?: boolean;
  /** Verified Identity Trust Marker. */
  viTM?: boolean;
  /** Compliant Actor Trust Marker. */
  caTM?: boolean;
  /** Governed Use Case Trust Marker — is the credential type governed? */
  gucTM?: boolean;
  /** Governed Use Case Authorization Trust Marker — may this issuer issue it? */
  gucaTM?: boolean;
}

export interface WalletResponse {
  error_code?: VerificationErrorCode;
  error_description?: string;
  /** Disclosed claims, keyed by the DCQL credential query id. */
  credential_subject_data?: Record<string, Record<string, unknown>>;
  /** Raw presentations, only when the audit feature is enabled. */
  vp_token?: Record<string, string[]>;
}

export type VerificationErrorCode =
  | 'credential_invalid'
  | 'jwt_expired'
  | 'jwt_premature'
  | 'missing_nonce'
  | 'invalid_format'
  | 'credential_expired'
  | 'unsupported_format'
  | 'credential_revoked'
  | 'credential_suspended'
  | 'credential_missing_data'
  | 'holder_binding_mismatch'
  | 'client_rejected'
  | 'issuer_not_accepted'
  | 'authorization_request_object_not_found'
  | 'verification_process_closed'
  | (string & {});

export interface VerifierWebhookCallback {
  verification_id: string;
  timestamp?: string;
}
