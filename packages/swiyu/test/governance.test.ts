import { describe, expect, it } from 'vitest';

import {
  credentialQuery,
  INSURANCE_CARD,
  LAB_REPORT,
  PRESCRIPTION,
  ProtectedClaimError,
  reviewPresentation,
  reviewRequest,
  reviewTrustMarkers,
  ROLE,
  SANDBOX_HEALTH_POLICY,
  STRICT_HEALTH_POLICY,
} from '../src/index.js';

describe('who may ask for what', () => {
  it('lets a practice request cover, including the AHV number it bills with', () => {
    const decision = reviewRequest({
      definition: INSURANCE_CARD,
      role: ROLE.practice,
      requestedClaims: ['insurer_name', 'coverage', 'personal_administrative_number'],
    });
    expect(decision.outcome).toBe('allow');
  });

  it('refuses a pharmacy the AHV number, which it has no entitlement to', () => {
    const decision = reviewRequest({
      definition: INSURANCE_CARD,
      role: ROLE.pharmacy,
      requestedClaims: ['insurer_name', 'personal_administrative_number'],
    });
    expect(decision.outcome).toBe('deny');
    expect(decision.reasons.at(-1)).toContain('exceed what role');
  });

  it('refuses a role with no entitlement at all', () => {
    const decision = reviewRequest({
      definition: PRESCRIPTION,
      role: ROLE.insurer,
      requestedClaims: ['medication'],
    });
    expect(decision.outcome).toBe('deny');
    expect(decision.reasons[0]).toContain('not entitled');
  });

  it('refuses claims beyond the entitlement even for an entitled role', () => {
    const decision = reviewRequest({
      definition: PRESCRIPTION,
      role: ROLE.practice,
      requestedClaims: ['medication', 'patient_birth_date'],
    });
    expect(decision.outcome).toBe('deny');
    expect(decision.reasons.at(-1)).toContain('patient_birth_date');
  });

  it('keeps identifying claims out of reach of secondary use', () => {
    const research = reviewRequest({
      definition: LAB_REPORT,
      role: ROLE.research,
      requestedClaims: ['findings', 'specimen_date'],
    });
    expect(research.outcome).toBe('allow');

    const identified = reviewRequest({
      definition: LAB_REPORT,
      role: ROLE.research,
      requestedClaims: ['findings', 'patient_family_name'],
    });
    expect(identified.outcome).toBe('deny');
  });
});

describe('the DCQL builder refuses protected claims on its own', () => {
  it('throws when a protected claim is requested without authorization', () => {
    expect(() =>
      credentialQuery({
        id: 'card',
        definition: INSURANCE_CARD,
        claims: ['personal_administrative_number'],
      }),
    ).toThrow(ProtectedClaimError);
  });

  it('allows it when the caller states the authorization explicitly', () => {
    const query = credentialQuery({
      id: 'card',
      definition: INSURANCE_CARD,
      claims: ['personal_administrative_number'],
      protectedClaimsAuthorized: true,
    });
    expect(query.claims).toEqual([{ path: ['personal_administrative_number'] }]);
  });

  it('rejects a claim the credential type does not define', () => {
    expect(() =>
      credentialQuery({ id: 'card', definition: INSURANCE_CARD, claims: ['diagnosis'] }),
    ).toThrow(/has no claim/);
  });
});

describe('trust markers', () => {
  it('always refuses a governed use case without authorization, under any policy', () => {
    const markers = { gucTM: true, gucaTM: false, viTM: true, caTM: true };
    for (const policy of [STRICT_HEALTH_POLICY, SANDBOX_HEALTH_POLICY]) {
      expect(reviewTrustMarkers(markers, policy).outcome).toBe('deny');
    }
  });

  it('refuses an unverified identity under the strict policy and waives it under the Sandbox one', () => {
    const markers = { viTM: false, caTM: false };
    expect(reviewTrustMarkers(markers, STRICT_HEALTH_POLICY).outcome).toBe('deny');
    const sandbox = reviewTrustMarkers(markers, SANDBOX_HEALTH_POLICY);
    expect(sandbox.outcome).toBe('allow');
    // The waiver is recorded rather than silently applied.
    expect(sandbox.reasons.join(' ')).toContain('waived');
  });
});

describe('presentations', () => {
  it('refuses a revoked credential before trust is even considered', () => {
    const decision = reviewPresentation(
      { credential_status: { valid: false, status: 1 }, valid: true, trust_markers: { viTM: true, caTM: true } },
      SANDBOX_HEALTH_POLICY,
    );
    expect(decision.outcome).toBe('deny');
    expect(decision.reasons[0]).toContain('status 1');
  });

  it('refuses a suspended credential', () => {
    const decision = reviewPresentation(
      { credential_status: { valid: false, status: 2 }, valid: true },
      SANDBOX_HEALTH_POLICY,
    );
    expect(decision.outcome).toBe('deny');
  });

  it('accepts a valid credential from a trusted issuer', () => {
    const decision = reviewPresentation(
      {
        credential_status: { valid: true, status: 0 },
        valid: true,
        trust_markers: { viTM: true, caTM: true, gucTM: true, gucaTM: true },
      },
      STRICT_HEALTH_POLICY,
    );
    expect(decision.outcome).toBe('allow');
  });
});
