import { describe, expect, it } from 'vitest';

import {
  buildIssuerMetadata,
  buildJsonSchema,
  buildOcaBundle,
  buildVctMetadata,
  checkIssuerMetadata,
  checkOcaBundle,
  checkVerificationRequest,
  credentialQuery,
  dcqlQuery,
  INSURANCE_CARD,
  LAB_REPORT,
  PRESCRIPTION,
  PROFILE_VERSION,
  type CreateVerificationRequest,
} from '../src/index.js';

const uris = {
  vctMetadataUri: 'https://praxis.example.ch/oid4vci/vct/rx',
  schemaUri: 'https://praxis.example.ch/oid4vci/json-schema/rx',
  ocaUri: 'https://praxis.example.ch/oid4vci/oca/rx',
};

function metadataFor(definition = PRESCRIPTION) {
  const schema = JSON.stringify(buildJsonSchema(definition, uris.schemaUri));
  const oca = JSON.stringify(buildOcaBundle(definition));
  const vct = JSON.stringify(buildVctMetadata(definition, uris, { schema, oca }));
  return buildIssuerMetadata({
    externalUrl: 'https://praxis.example.ch',
    display: { name: { 'de-CH': 'Praxis' } },
    definitions: [definition],
    metadataUris: () => uris,
    documents: () => ({ vct }),
  });
}

describe('issuer metadata', () => {
  it('is conformant as generated', () => {
    expect(checkIssuerMetadata(metadataFor())).toEqual([]);
  });

  it('carries the profile version the Sandbox requires', () => {
    expect(metadataFor().profile_version).toBe(PROFILE_VERSION.issuance);
  });

  it('rejects metadata with request or response encryption switched off', () => {
    const metadata = metadataFor();
    (metadata.credential_response_encryption as { encryption_required: boolean }).encryption_required = false;
    const findings = checkIssuerMetadata(metadata);
    expect(findings.map((finding) => finding.message)).toContain(
      'credential_response_encryption.encryption_required MUST be true',
    );
  });

  it('rejects a batch size below the privacy floor of ten', () => {
    const metadata = metadataFor();
    metadata.batch_credential_issuance = { batch_size: 3 };
    expect(checkIssuerMetadata(metadata).some((finding) => finding.rule.includes('14.A'))).toBe(true);
  });

  it('rejects a credential format other than dc+sd-jwt', () => {
    const metadata = metadataFor();
    const configurations = metadata.credential_configurations_supported as Record<string, Record<string, unknown>>;
    const first = Object.values(configurations)[0];
    if (first) first.format = 'mso_mdoc';
    expect(checkIssuerMetadata(metadata).some((finding) => finding.message.includes('ISO mdoc'))).toBe(true);
  });

  it('rejects a non-data-URL logo', () => {
    const metadata = metadataFor();
    metadata.display = [{ name: 'Praxis', locale: 'de-CH', logo: { uri: 'https://example.ch/logo.png' } }];
    expect(checkIssuerMetadata(metadata).some((finding) => finding.message.includes('data URL'))).toBe(true);
  });
});

describe('OCA bundles', () => {
  it('are conformant for every credential type', () => {
    for (const definition of [INSURANCE_CARD, PRESCRIPTION, LAB_REPORT]) {
      expect(checkOcaBundle(buildOcaBundle(definition)), definition.vct).toEqual([]);
    }
  });

  it('has exactly one root capture base even with nested claims', () => {
    const bundle = buildOcaBundle(PRESCRIPTION) as { capture_bases: { digest: string; attributes: Record<string, string> }[] };
    // The medication array is a referenced capture base, so there are two.
    expect(bundle.capture_bases).toHaveLength(2);
    expect(checkOcaBundle(bundle as unknown as Record<string, unknown>)).toEqual([]);
  });

  it('rejects a bundle with two unreferenced capture bases', () => {
    const bundle = buildOcaBundle(PRESCRIPTION) as unknown as Record<string, unknown>;
    const bases = bundle.capture_bases as { digest: string; attributes: Record<string, string> }[];
    // Break the reference from the root, leaving two roots behind.
    const root = bases[0];
    if (root) root.attributes = { only: 'Text' };
    expect(checkOcaBundle(bundle).some((finding) => finding.message.includes('exactly one root'))).toBe(true);
  });

  it('flags an overlay type outside the profile', () => {
    const bundle = buildOcaBundle(LAB_REPORT) as unknown as Record<string, unknown>;
    const overlays = bundle.overlays as Record<string, unknown>[];
    const digest = (bundle.capture_bases as { digest: string }[])[0]?.digest;
    overlays.push({ type: 'spec/overlays/unit/1.0', capture_base: digest });
    expect(checkOcaBundle(bundle).some((finding) => finding.message.includes('outside the profile'))).toBe(true);
  });
});

describe('verification requests', () => {
  const base = (): CreateVerificationRequest => ({
    dcql_query: dcqlQuery(
      credentialQuery({
        id: 'prescription',
        definition: PRESCRIPTION,
        claims: ['medication', 'expiry_date'],
        acceptedIssuerDids: ['did:webvh:example:praxis'],
      }),
    ),
    jwt_secured_authorization_request: true,
    response_mode: 'direct_post.jwt',
    accepted_issuer_dids: ['did:webvh:example:praxis'],
    verification_purpose: {
      scope: 'ch.didas.health.dispense',
      purpose_name: { default: 'Dispense' },
      purpose_description: { default: 'Read the prescription to dispense it.' },
    },
  });

  it('accepts a request built the way the profile requires', () => {
    expect(checkVerificationRequest(base())).toEqual([]);
  });

  it('rejects a cleartext response mode', () => {
    const request = { ...base(), response_mode: 'direct_post' as const };
    expect(checkVerificationRequest(request).some((f) => f.message.includes('direct_post.jwt'))).toBe(true);
  });

  it('rejects an unsigned authorization request', () => {
    const request = { ...base(), jwt_secured_authorization_request: false };
    expect(checkVerificationRequest(request).some((f) => f.message.includes('signed JAR'))).toBe(true);
  });

  it('rejects a request that would accept any issuer', () => {
    const request = { ...base() };
    delete request.accepted_issuer_dids;
    expect(checkVerificationRequest(request).some((f) => f.rule.includes('swiss-profile-trust'))).toBe(true);
  });

  it('rejects a purpose name longer than the Trust Registry allows', () => {
    const request = base();
    // 45 characters passes the verifier's own validation and then fails at the
    // vqPS submission, so the tighter registry limit is the one to enforce.
    request.verification_purpose = {
      scope: 'ch.didas.health.dispense',
      purpose_name: { default: 'x'.repeat(45) },
      purpose_description: { default: 'ok' },
    };
    expect(checkVerificationRequest(request).some((f) => f.message.includes('40 characters'))).toBe(true);
  });

  it('accepts the purpose names this project actually uses', () => {
    for (const name of [
      'Check vaccination protection',
      'Check-in at the practice',
      'Dispense prescribed medication',
    ]) {
      const request = base();
      request.verification_purpose = {
        scope: 'ch.didas.health.test',
        purpose_name: { default: name },
        purpose_description: { default: 'ok' },
      };
      expect(checkVerificationRequest(request), name).toEqual([]);
    }
  });
});
