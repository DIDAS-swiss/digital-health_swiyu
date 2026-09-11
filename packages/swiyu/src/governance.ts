/**
 * The governance layer.
 *
 * The technical profile answers "can this message be validated?". Governance
 * answers the questions that actually decide whether a health credential should
 * change hands: may this actor issue this credential type, may that actor ask
 * for it, which claims may they ask for, what were they told the data is for,
 * and what happens to it afterwards.
 *
 * In the swiyu trust infrastructure those answers arrive as Trust Protocol 2.0
 * trust markers on the counterparty's DID. This module turns the markers plus
 * the credential type's own rules into a decision, and records that decision so
 * the practice can show, later, why it released a patient's data.
 */

import type { CredentialDefinition, VerifierEntitlement } from './credential-definition.js';
import { PROTECTED_CLAIMS } from './profile.js';
import type { CredentialEvaluation, IssuerTrustMarker } from './types.js';

/** Roles in the health use case. Each corresponds to a registered trust role. */
export const ROLE = {
  insurer: 'ch.didas.health.role.insurer',
  practice: 'ch.didas.health.role.practice',
  pharmacy: 'ch.didas.health.role.pharmacy',
  laboratory: 'ch.didas.health.role.laboratory',
  /** A practice, pharmacy or occupational health service authorised to vaccinate. */
  vaccinator: 'ch.didas.health.role.vaccinator',
  /** Asks only whether protection exists, never how it came about. */
  travelClinic: 'ch.didas.health.role.travel-clinic',
  research: 'ch.didas.health.role.research',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export type DecisionOutcome = 'allow' | 'deny';

export interface Decision {
  outcome: DecisionOutcome;
  /** Reasons in the order they were evaluated; the first denial is decisive. */
  reasons: string[];
}

/* ------------------------------------------------ who may issue what */

/**
 * Decide whether an actor may issue a credential type at all.
 *
 * Verification-side governance gets most of the attention, but the issuing side
 * is where a trust infrastructure earns its name: a credential is only worth
 * checking if not everyone could have produced one. An actor holds a set of
 * registered roles — a practice that also vaccinates holds both — and may issue
 * a credential type only if one of them is the type's issuer role.
 */
export function reviewIssuance(
  definition: CredentialDefinition,
  roles: readonly (Role | string)[],
): Decision {
  const governance = definition.governance;
  if (!governance) {
    return {
      outcome: 'deny',
      reasons: [`${definition.vct} states no issuer role, so no actor can be authorised to issue it`],
    };
  }
  if (!roles.includes(governance.issuerRole)) {
    return {
      outcome: 'deny',
      reasons: [
        `issuing ${definition.vct} requires the role ${governance.issuerRole}; ` +
          `this actor holds ${roles.join(', ') || 'no roles'}`,
      ],
    };
  }
  return {
    outcome: 'allow',
    reasons: [
      `issued as ${governance.issuerRole}`,
      governance.issuerBasis ?? 'no legal basis stated for this credential type',
    ],
  };
}

/* --------------------------------------------- what a verifier may ask for */

export interface RequestReview {
  definition: CredentialDefinition;
  /** Role the requesting actor claims, as registered in the trust registry. */
  role: Role | string;
  /** Claims the actor wants to request. */
  requestedClaims: string[];
}

/**
 * Decide whether a verifier may ask for these claims *before* the request goes
 * out. Enforcing minimisation at the point the query is built is the only place
 * it can be enforced: once the wallet has answered, the data is already out.
 */
export function reviewRequest(review: RequestReview): Decision {
  const reasons: string[] = [];
  const governance = review.definition.governance;
  if (!governance) {
    return {
      outcome: 'deny',
      reasons: [`${review.definition.vct} has no governance rules, so no request can be authorised against it`],
    };
  }

  const entitlement = governance.verifierRoles.find((candidate) => candidate.role === review.role);
  if (!entitlement) {
    return {
      outcome: 'deny',
      reasons: [
        `role ${review.role} is not entitled to request ${review.definition.vct}; ` +
          `entitled roles: ${governance.verifierRoles.map((r) => r.role).join(', ') || 'none'}`,
      ],
    };
  }
  reasons.push(`role ${review.role} is entitled to request ${review.definition.vct} for: ${entitlement.purpose}`);

  const excess = review.requestedClaims.filter((claim) => !entitlement.claims.includes(claim));
  if (excess.length > 0) {
    return {
      outcome: 'deny',
      reasons: [
        ...reasons,
        `claims ${excess.join(', ')} exceed what role ${review.role} may request ` +
          `(permitted: ${entitlement.claims.join(', ')})`,
      ],
    };
  }

  const unauthorizedProtected = review.requestedClaims
    .filter((claim) => PROTECTED_CLAIMS.includes(claim))
    .filter((claim) => !(entitlement.protectedClaims ?? []).includes(claim));
  if (unauthorizedProtected.length > 0) {
    return {
      outcome: 'deny',
      reasons: [
        ...reasons,
        `protected field(s) ${unauthorizedProtected.join(', ')} require a Governed Use Case Authorization ` +
          `Trust Marker that role ${review.role} does not hold (swiss-profile-trust 1.0, Protected fields)`,
      ],
    };
  }

  reasons.push(`requested claims stay within the minimisation envelope (${review.requestedClaims.length} claim(s))`);
  return { outcome: 'allow', reasons };
}

/** The entitlement a role holds for a credential type, if any. */
export function entitlementFor(
  definition: CredentialDefinition,
  role: Role | string,
): VerifierEntitlement | undefined {
  return definition.governance?.verifierRoles.find((candidate) => candidate.role === role);
}

/* ------------------------------------ what an actor does with the response */

export interface TrustPolicy {
  /**
   * swiss-profile-trust: an actor **SHOULD** decline a relationship without the
   * Verified Identity Trust Marker. Health data is exactly the case where that
   * SHOULD is treated as a MUST.
   */
  requireVerifiedIdentity: boolean;
  /** Decline when the counterparty is not marked a compliant actor. */
  requireCompliantActor: boolean;
  /**
   * swiss-profile-trust: an actor **MUST** decline any relationship carrying the
   * Governed Use Case Trust Marker without the matching authorization marker.
   * This one is not configurable — it is a MUST — and is enforced regardless.
   */
  readonly enforceGovernedUseCase: true;
}

export const STRICT_HEALTH_POLICY: TrustPolicy = {
  requireVerifiedIdentity: true,
  requireCompliantActor: true,
  enforceGovernedUseCase: true,
};

/**
 * A policy for the Sandbox, where most actors have not been through a full
 * identity onboarding and the trust registry is still being populated. It keeps
 * the MUST rules and relaxes the SHOULDs, which is the honest way to run a
 * demonstrator: the rule is not deleted, it is recorded as waived.
 */
export const SANDBOX_HEALTH_POLICY: TrustPolicy = {
  requireVerifiedIdentity: false,
  requireCompliantActor: false,
  enforceGovernedUseCase: true,
};

/** Apply the trust policy to the markers the generic verifier evaluated. */
export function reviewTrustMarkers(
  markers: IssuerTrustMarker | undefined,
  policy: TrustPolicy,
): Decision {
  const reasons: string[] = [];
  if (!markers) {
    return {
      outcome: policy.requireVerifiedIdentity ? 'deny' : 'allow',
      reasons: [
        'no trust markers were evaluated for the issuer' +
          (policy.requireVerifiedIdentity ? '' : ' (accepted under the Sandbox policy)'),
      ],
    };
  }

  // MUST: governed use case without authorization is always a denial.
  if (markers.gucTM === true && markers.gucaTM !== true) {
    return {
      outcome: 'deny',
      reasons: [
        'issuer carries the Governed Use Case Trust Marker but not the Governed Use Case ' +
          'Authorization Trust Marker — swiss-profile-trust requires declining this relationship',
      ],
    };
  }
  if (markers.gucTM === true) {
    reasons.push('issuer is authorised for this governed use case (gucTM + gucaTM)');
  }

  if (policy.requireVerifiedIdentity && markers.viTM !== true) {
    return { outcome: 'deny', reasons: [...reasons, 'issuer lacks the Verified Identity Trust Marker'] };
  }
  if (markers.viTM === true) reasons.push('issuer identity is verified (viTM)');
  else reasons.push('issuer identity is NOT verified — waived by the Sandbox policy');

  if (policy.requireCompliantActor && markers.caTM !== true) {
    return { outcome: 'deny', reasons: [...reasons, 'issuer lacks the Compliant Actor Trust Marker'] };
  }
  if (markers.caTM === true) reasons.push('issuer is a compliant actor (caTM)');

  return { outcome: 'allow', reasons };
}

/**
 * Combine the technical evaluation the generic verifier performed (signature,
 * key binding, status list) with the governance evaluation.
 */
export function reviewPresentation(
  evaluation: CredentialEvaluation | undefined,
  policy: TrustPolicy,
): Decision {
  const reasons: string[] = [];
  if (!evaluation) {
    return { outcome: 'deny', reasons: ['the wallet returned no evaluation for this credential query'] };
  }
  if (evaluation.credential_status && evaluation.credential_status.valid !== true) {
    return {
      outcome: 'deny',
      reasons: [`credential status list reports status ${evaluation.credential_status.status} (not valid)`],
    };
  }
  reasons.push('credential is not revoked or suspended on its status list');
  if (evaluation.valid === false) {
    return { outcome: 'deny', reasons: [...reasons, 'the verifier rejected the presentation as invalid'] };
  }
  reasons.push('signature, key binding and issuer DID resolution succeeded');

  const trust = reviewTrustMarkers(evaluation.trust_markers, policy);
  return { outcome: trust.outcome, reasons: [...reasons, ...trust.reasons] };
}

/* ------------------------------------------------------- the audit record */

/**
 * What a practice has to be able to show afterwards: who asked, for what, on
 * what legal basis, what the holder actually released, and what the governance
 * decision was. Note what is deliberately *not* here — the claim values. The
 * record proves the interaction happened within the rules without becoming a
 * second copy of the patient's data.
 */
export interface GovernanceRecord {
  timestamp: string;
  /** The verification or issuance this record belongs to. */
  interactionId: string;
  actorRole: Role | string;
  actorDid?: string;
  credentialType: string;
  purposeScope: string;
  /** Claim *names* released, never their values. */
  claimsReleased: string[];
  decision: DecisionOutcome;
  reasons: string[];
  retention?: string;
}

export function recordDecision(input: Omit<GovernanceRecord, 'timestamp'>): GovernanceRecord {
  return { timestamp: new Date().toISOString(), ...input };
}
