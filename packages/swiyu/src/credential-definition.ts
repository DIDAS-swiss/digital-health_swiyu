/**
 * A single source of truth for a credential type.
 *
 * A credential type in the swiyu ecosystem is described by four artefacts that
 * have to agree with each other: the OID4VCI `credential_configurations_supported`
 * entry, the SD-JWT VC Type Metadata, an optional JSON Schema, and an OCA bundle
 * for visualisation. Hand-maintaining four documents per credential is how they
 * drift apart, so here one `CredentialDefinition` generates all four, and the
 * integrity hashes that bind them together are computed rather than pasted.
 */

import { withCesrDigest } from './cesr.js';
import {
  CREDENTIAL_FORMAT,
  CRYPTO,
  LIMITS,
  PROFILE_VERSION,
  PROTECTED_CLAIMS,
} from './profile.js';
import { integrity } from './sri.js';

/** The OCA attribute types the Swiss Profile requires wallets to support. */
export type OcaAttributeType =
  | 'Text'
  | 'Numeric'
  | 'Boolean'
  | 'DateTime'
  | 'Binary'
  | 'Reference'
  | 'Array[Text]'
  | 'Array[Numeric]'
  | 'Array[Boolean]'
  | 'Array[DateTime]'
  | 'Array[Binary]'
  | 'Array[Reference]';

/** BCP-47 tags used across the demo. `default` is OCA's fallback key. */
export type Locale = 'de-CH' | 'fr-CH' | 'it-CH' | 'en-GB';

export type Localized = Partial<Record<Locale, string>>;

/**
 * Where a claim comes from in the established clinical information models.
 *
 * The project reuses the *models* of openEHR and HL7 FHIR — archetype paths,
 * resource elements, terminology codes — while deliberately not reusing their
 * usual deployment shape, a central clinical data repository. The patient's
 * wallet is the repository; these bindings are what let a practice system, a
 * pharmacy system or a research pipeline understand a credential it has never
 * seen before, and what let a presented credential be projected back into a
 * FHIR resource or an openEHR composition at the point of use.
 */
export interface SemanticBinding {
  openehr?: {
    /** Archetype the node belongs to, e.g. `openEHR-EHR-OBSERVATION.laboratory_test_result.v1`. */
    archetypeId?: string;
    /**
     * The node's name as published in the openEHR Clinical Knowledge Manager,
     * e.g. `Batch ID`. The flat path below is template-specific and this
     * repository publishes no operational template, so the archetype and the
     * node name are the part a receiver can actually resolve: they identify a
     * governed model in CKM, which the flat path alone does not.
     */
    element?: string;
    /** Flat-format path within the operational template. */
    path: string;
  };
  fhir?: {
    /** FHIRPath-style element path, e.g. `Observation.valueQuantity.value`. */
    path: string;
  };
  /** Code system binding for the claim itself (not its value). */
  terminology?: { system: string; code: string; display?: string };
}

export interface ClaimDefinition {
  /** Claim name as it appears in the SD-JWT VC payload. */
  name: string;
  /** Mapping onto openEHR / HL7 FHIR / terminology. */
  semantics?: SemanticBinding;
  type: OcaAttributeType;
  label: Localized;
  description?: Localized;
  /** OCA Format Overlay value, e.g. an ISO 8601 pattern or a MIME type. */
  format?: string;
  /** OCA Character Encoding Overlay value. Binary attributes MUST declare base64. */
  encoding?: 'utf-8' | 'base64';
  /** Marked in the OCA Sensitive Overlay; wallets mask these until tapped. */
  sensitive?: boolean;
  /** JSON Schema fragment describing the claim's value. */
  schema: Record<string, unknown>;
  required?: boolean;
  /** Nested object claims: their own sub-definition, mapped by OCA `Reference`. */
  nested?: ClaimDefinition[];
}

export interface CredentialDefinition {
  /**
   * Key into `credential_configurations_supported`. Also the id a business
   * issuer passes as `metadata_credential_supported_id`.
   */
  configurationId: string;
  /**
   * The `vct` claim. A stable URN rather than a URL, so that DCQL queries and
   * issued credentials do not change meaning when a deployment moves host —
   * resolution happens through `vct_metadata_uri` instead (swiss-profile-vc
   * §5.3.3 gives that claim precedence anyway).
   */
  vct: string;
  name: string;
  description: Localized;
  /** Display name of the credential in the wallet, per locale. */
  displayName: Localized;
  /** `#RRGGBB` background of the credential card. */
  backgroundColor: string;
  /** Foreground/primary text colour of the credential card. */
  textColor?: string;
  /** Data URL (`data:image/png;base64,...`) of the issuer / credential logo. */
  logo?: string;
  /** Branding overlay template for the card's headline, e.g. `{{family_name}}`. */
  primaryField?: string;
  secondaryField?: string;
  claims: ClaimDefinition[];
  /** Claim order on the credential card; unlisted claims sort after these. */
  order?: string[];
  /** Whether the wallet may re-request this credential from the credential endpoint. */
  refreshable?: boolean;
  /** Clinical model this credential type is derived from. */
  semantics?: {
    openehr?: { templateId: string; archetypeId: string };
    fhir?: { resourceType: string; profile?: string };
  };
  /** Who may issue it, who may ask for it, and on what basis. */
  governance?: CredentialGovernance;
}

/**
 * The governance rules attached to a credential type.
 *
 * Trust in this ecosystem is not a property of a server certificate; it is a
 * statement someone made about someone else, published in the trust registry
 * and checked at presentation time. Writing those expectations down next to the
 * data model keeps the two from drifting apart: a credential type whose issuer
 * eligibility lives only in a slide deck cannot be enforced by code.
 */
export interface CredentialGovernance {
  /**
   * The registered role an issuer must hold. In the swiyu Trust Protocol this
   * corresponds to a Governed Use Case Authorization Trust Marker naming this
   * credential type.
   */
  issuerRole: string;
  /** Legal or professional basis the issuer acts under, for the record. */
  issuerBasis?: string;
  /** Roles that may request this credential, and which claims each may ask for. */
  verifierRoles: VerifierEntitlement[];
  /**
   * Whether the credential type is *governed*: if true, an actor MUST decline
   * the interaction when the counterparty carries the Governed Use Case Trust
   * Marker without the matching authorization marker.
   */
  governed: boolean;
  /** Retention expectation for a verifier that receives these claims. */
  retention?: string;
  /** Who may revoke, and on what trigger. */
  revocation?: string;
}

export interface VerifierEntitlement {
  /** Role identifier, e.g. `ch.didas.health.role.pharmacy`. */
  role: string;
  /** Human-readable reason this role is entitled to ask. */
  purpose: string;
  /**
   * The maximum set of claims this role may request. A request for anything
   * outside it is a data-minimisation violation, not a preference.
   */
  claims: string[];
  /** Claims from the profile's protected-field list this role is authorized for. */
  protectedClaims?: string[];
}

/* ------------------------------------------------------------ JSON Schema */

export function buildJsonSchema(definition: CredentialDefinition, schemaId: string): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const claim of definition.claims) {
    properties[claim.name] = claim.nested
      ? nestedSchema(claim)
      : { ...claim.schema, title: claim.label['en-GB'] ?? claim.label['de-CH'] ?? claim.name };
    if (claim.required) required.push(claim.name);
  }
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: schemaId,
    title: definition.name,
    type: 'object',
    properties,
    required,
    // The Swiss Profile forbids non-selectively-disclosable business claims, so
    // an issuer that adds an unexpected claim is a bug worth catching here.
    additionalProperties: false,
  };
}

function nestedSchema(claim: ClaimDefinition): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const child of claim.nested ?? []) {
    properties[child.name] = child.nested ? nestedSchema(child) : child.schema;
    if (child.required) required.push(child.name);
  }
  const object = { type: 'object', properties, required, additionalProperties: false };
  return claim.type.startsWith('Array[') ? { type: 'array', items: object } : object;
}

/* ------------------------------------------------------------- OCA bundle */

interface CaptureBase {
  type: 'spec/capture_base/1.0';
  digest?: string;
  attributes: Record<string, string>;
}

/**
 * Build the OCA bundle: one root Capture Base, one referenced Capture Base per
 * nested claim, and the overlays the Swiss Profile requires wallets to support.
 */
export function buildOcaBundle(definition: CredentialDefinition): Record<string, unknown> {
  const captureBases: (CaptureBase & { digest: string })[] = [];

  // Nested claims become their own Capture Base, referenced by digest. Build
  // them first: a reference can only be written once the target has a digest.
  const references = new Map<string, string>();
  for (const claim of definition.claims) {
    if (!claim.nested) continue;
    const child = withCesrDigest<CaptureBase>({
      type: 'spec/capture_base/1.0',
      attributes: Object.fromEntries(claim.nested.map((c) => [c.name, c.type])),
    });
    captureBases.push(child);
    references.set(claim.name, child.digest);
  }

  const rootAttributes: Record<string, string> = {};
  for (const claim of definition.claims) {
    const reference = references.get(claim.name);
    rootAttributes[claim.name] = reference ? `refs:${reference}` : claim.type;
  }
  const root = withCesrDigest<CaptureBase>({
    type: 'spec/capture_base/1.0',
    attributes: rootAttributes,
  });
  captureBases.unshift(root);

  const overlays: Record<string, unknown>[] = [];
  const allClaims = flattenClaims(definition.claims);

  // Character Encoding — required so a wallet knows how to read Binary values.
  overlays.push({
    type: 'spec/overlays/character_encoding/1.0',
    capture_base: root.digest,
    attribute_character_encoding: Object.fromEntries(
      definition.claims.map((c) => [c.name, c.encoding ?? (c.type === 'Binary' ? 'base64' : 'utf-8')]),
    ),
  });

  // Format — MIME types for binary attributes, value patterns for the rest.
  const formats = Object.fromEntries(
    definition.claims.filter((c) => c.format).map((c) => [c.name, c.format as string]),
  );
  if (Object.keys(formats).length > 0) {
    overlays.push({
      type: 'spec/overlays/format/1.0',
      capture_base: root.digest,
      attribute_formats: formats,
    });
  }

  // Meta and Label, per locale.
  for (const locale of localesOf(definition)) {
    overlays.push({
      type: 'spec/overlays/meta/1.0',
      capture_base: root.digest,
      language: locale,
      name: definition.displayName[locale] ?? definition.name,
      description: definition.description[locale] ?? '',
    });
    overlays.push({
      type: 'spec/overlays/label/1.1',
      capture_base: root.digest,
      language: locale,
      attribute_labels: Object.fromEntries(
        definition.claims.map((c) => [c.name, c.label[locale] ?? c.name]),
      ),
    });
    // Nested Capture Bases carry their own labels.
    for (const claim of definition.claims) {
      const reference = references.get(claim.name);
      if (!reference || !claim.nested) continue;
      overlays.push({
        type: 'spec/overlays/label/1.1',
        capture_base: reference,
        language: locale,
        attribute_labels: Object.fromEntries(
          claim.nested.map((c) => [c.name, c.label[locale] ?? c.name]),
        ),
      });
    }
  }

  // Sensitive — wallets mask these until the holder chooses to reveal them.
  const sensitive = allClaims.filter((c) => c.sensitive).map((c) => c.name);
  if (sensitive.length > 0) {
    overlays.push({
      type: 'spec/overlays/sensitive/1.0',
      capture_base: root.digest,
      attributes: sensitive,
    });
  }

  // Order — identifiers and administrative data belong at the bottom of a card.
  if (definition.order && definition.order.length > 0) {
    overlays.push({
      type: 'extend/overlays/order/1.0',
      capture_base: root.digest,
      attribute_orders: Object.fromEntries(definition.order.map((name, index) => [name, index + 1])),
    });
  }

  // Data Source Mapping — binds Capture Base attributes to claims path pointers
  // in the disclosed SD-JWT VC.
  overlays.push({
    type: 'extend/overlays/data_source/2.0',
    capture_base: root.digest,
    format: CREDENTIAL_FORMAT,
    attribute_sources: Object.fromEntries(definition.claims.map((c) => [c.name, [c.name]])),
  });
  for (const claim of definition.claims) {
    const reference = references.get(claim.name);
    if (!reference || !claim.nested) continue;
    const isArray = claim.type.startsWith('Array[');
    overlays.push({
      type: 'extend/overlays/data_source/2.0',
      capture_base: reference,
      format: CREDENTIAL_FORMAT,
      attribute_sources: Object.fromEntries(
        claim.nested.map((c) => [
          c.name,
          isArray ? [claim.name, null, c.name] : [claim.name, c.name],
        ]),
      ),
    });
  }

  // Branding — one per locale and theme. Wallets in dark mode look for `dark`.
  for (const locale of localesOf(definition)) {
    for (const theme of ['light', 'dark'] as const) {
      overlays.push({
        type: 'aries/overlays/branding/1.1',
        capture_base: root.digest,
        language: locale,
        theme,
        ...(definition.logo ? { logo: definition.logo } : {}),
        primary_background_color: definition.backgroundColor,
        ...(definition.textColor ? { secondary_background_color: definition.textColor } : {}),
        primary_field: definition.primaryField ?? '',
        secondary_field: definition.secondaryField ?? '',
      });
    }
  }

  return {
    // Required by swiss-profile-vc for the OCA Bundle JSON body.
    profile_version: PROFILE_VERSION.vc,
    capture_bases: captureBases,
    overlays,
  };
}

function localesOf(definition: CredentialDefinition): Locale[] {
  const locales = new Set<Locale>();
  for (const key of Object.keys(definition.displayName)) locales.add(key as Locale);
  return locales.size > 0 ? [...locales] : ['de-CH'];
}

function flattenClaims(claims: ClaimDefinition[]): ClaimDefinition[] {
  return claims.flatMap((c) => [c, ...(c.nested ? flattenClaims(c.nested) : [])]);
}

/* ---------------------------------------------------------- VCT metadata */

export interface MetadataUris {
  /** Absolute URL the issuer serves the Type Metadata at. */
  vctMetadataUri: string;
  /** Absolute URL the issuer serves the JSON Schema at. */
  schemaUri: string;
  /** Absolute URL the issuer serves the OCA bundle at. */
  ocaUri: string;
}

/**
 * SD-JWT VC Type Metadata, pointing at the JSON Schema and the OCA bundle and
 * binding both by SRI hash.
 */
export function buildVctMetadata(
  definition: CredentialDefinition,
  uris: MetadataUris,
  documents: { schema: string; oca: string },
): Record<string, unknown> {
  return {
    profile_version: PROFILE_VERSION.vc,
    vct: definition.vct,
    name: definition.name,
    description: definition.description['en-GB'] ?? definition.description['de-CH'] ?? definition.name,
    schema_uri: uris.schemaUri,
    'schema_uri#integrity': integrity(documents.schema),
    display: localesOf(definition).map((locale) => ({
      lang: locale,
      name: definition.displayName[locale] ?? definition.name,
      description: definition.description[locale] ?? '',
      rendering: {
        oca: {
          uri: uris.ocaUri,
          'uri#integrity': integrity(documents.oca),
        },
      },
    })),
  };
}

/* ------------------------------------------------- issuer metadata entry */

/**
 * The `credential_configurations_supported` entry for this credential type.
 *
 * `credential_metadata.display` is the fallback the wallet uses only when no
 * OCA bundle resolves, so it is kept deliberately minimal: OCA is the primary
 * visualisation path and duplicating it here is what causes the two to diverge.
 */
export function buildCredentialConfiguration(
  definition: CredentialDefinition,
  uris: MetadataUris,
  vctMetadataDocument: string,
): Record<string, unknown> {
  return {
    format: CREDENTIAL_FORMAT,
    // ES256 only: the Swiss Profile narrows the algorithm set to one.
    credential_signing_alg_values_supported: [CRYPTO.jwsAlg],
    // `jwk` only: the profile supports no other holder binding method.
    cryptographic_binding_methods_supported: ['jwk'],
    proof_types_supported: {
      jwt: { proof_signing_alg_values_supported: [CRYPTO.jwsAlg] },
    },
    ...(definition.refreshable === undefined
      ? {}
      : { credential_refresh_disabled: !definition.refreshable }),
    vct: definition.vct,
    vct_metadata_uri: uris.vctMetadataUri,
    'vct_metadata_uri#integrity': integrity(vctMetadataDocument),
    credential_metadata: {
      display: localesOf(definition).map((locale) => ({
        name: definition.displayName[locale] ?? definition.name,
        locale,
        description: definition.description[locale] ?? '',
        background_color: definition.backgroundColor,
        ...(definition.logo ? { logo: { uri: definition.logo } } : {}),
      })),
      claims: definition.claims.map((claim) => ({
        path: [claim.name],
        display: localesOf(definition).map((locale) => ({
          locale,
          name: claim.label[locale] ?? claim.name,
        })),
      })),
    },
    ...(definition.order ? { order: definition.order } : {}),
  };
}

/**
 * Assemble a complete issuer metadata document for a set of credential types.
 *
 * `externalUrl` must be the https URL the wallet can reach — the generic issuer
 * builds its deeplinks and .well-known responses from it.
 */
export function buildIssuerMetadata(options: {
  externalUrl: string;
  display: { name: Localized; logo?: string };
  definitions: CredentialDefinition[];
  metadataUris: (definition: CredentialDefinition) => MetadataUris;
  documents: (definition: CredentialDefinition) => { vct: string };
}): Record<string, unknown> {
  const base = options.externalUrl.replace(/\/+$/, '');
  const locales = Object.keys(options.display.name) as Locale[];
  return {
    // Required in the metadata body by swiss-profile-issuance §12.2.4.
    profile_version: PROFILE_VERSION.issuance,
    credential_issuer: base,
    credential_endpoint: `${base}/oid4vci/api/credential`,
    deferred_credential_endpoint: `${base}/oid4vci/api/deferred_credential`,
    // REQUIRED by the profile: the wallet fetches a fresh DPoP nonce here.
    nonce_endpoint: `${base}/oid4vci/api/nonce`,
    version: '1.0',
    display: locales.map((locale) => ({
      name: options.display.name[locale] ?? '',
      locale,
      ...(options.display.logo ? { logo: { uri: options.display.logo } } : {}),
    })),
    // Application-layer encryption is mandatory in both directions.
    credential_request_encryption: {
      encryption_required: true,
      alg_values_supported: [CRYPTO.encAlg],
      enc_values_supported: [...CRYPTO.encValuesSupported],
    },
    credential_response_encryption: {
      encryption_required: true,
      alg_values_supported: [CRYPTO.encAlg],
      enc_values_supported: [...CRYPTO.encValuesSupported],
    },
    // Batch issuance keeps presentations unlinkable; the floor of 10 is a
    // privacy requirement, not a tuning knob.
    batch_credential_issuance: { batch_size: LIMITS.minBatchSize },
    credential_configurations_supported: Object.fromEntries(
      options.definitions.map((definition) => [
        definition.configurationId,
        buildCredentialConfiguration(
          definition,
          options.metadataUris(definition),
          options.documents(definition).vct,
        ),
      ]),
    ),
  };
}

/** Claims in this definition that swiss-profile-trust marks as protected. */
export function protectedClaimsOf(definition: CredentialDefinition): string[] {
  return flattenClaims(definition.claims)
    .map((c) => c.name)
    .filter((name) => PROTECTED_CLAIMS.includes(name));
}
