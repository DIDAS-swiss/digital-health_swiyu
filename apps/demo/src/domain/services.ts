/**
 * The three actors of the use case, as services.
 *
 * Each method follows the same shape: decide under the governance rules, only
 * then talk to the trust infrastructure, and journal the decision either way.
 * The ordering matters — a request that governance would refuse never reaches
 * the wallet, and a refusal is recorded as deliberately as an approval.
 */

import { randomUUID } from 'node:crypto';

import {
  assertVerificationRequest,
  BETA_ID_CREDENTIAL,
  BETA_ID,
  credentialQuery,
  dcqlQuery,
  disclosedClaims,
  entitlementFor,
  IMMUNIZATION,
  INSURANCE_CARD,
  IssuerManagementClient,
  LAB_REPORT,
  PRESCRIPTION,
  PROTECTED_CLAIMS,
  IMMUNIZATION_STATUS,
  CHECK_IN,
  DISPENSE,
  recordDecision,
  reviewIssuance,
  reviewPresentation,
  reviewRequest,
  VerifierManagementClient,
  type CreateVerificationRequest,
  type CredentialDefinition,
  type Decision,
  type GovernanceRecord,
  type TrustPolicy,
  type VerificationManagementResponse,
  type VerificationQuerySpec,
} from '@didas/swiyu';

import type { ActorConfig, AppConfig } from '../config.js';
import { StatusListPool } from './status-lists.js';
import type { DemoStore, Encounter, IssuedCredential } from './store.js';

export interface ServiceDeps {
  config: AppConfig;
  store: DemoStore;
  statusLists: StatusListPool;
}

export interface OfferResult {
  credential: IssuedCredential;
  record: GovernanceRecord;
}

export interface VerificationStart {
  verificationId: string;
  deeplink: string;
  /** What the patient is about to be asked for, so the UI can show it up front. */
  requested: { credentialType: string; claims: string[] }[];
  purposeScope: string;
}

export class GovernanceRefusal extends Error {
  constructor(
    readonly decision: Decision,
    readonly record: GovernanceRecord,
  ) {
    super(decision.reasons.at(-1) ?? 'refused by governance');
    this.name = 'GovernanceRefusal';
  }
}

function issuerClient(actor: ActorConfig): IssuerManagementClient {
  if (!actor.issuerManagementUrl) {
    throw new Error(`actor ${actor.key} has no issuer management URL configured`);
  }
  return new IssuerManagementClient({ baseUrl: actor.issuerManagementUrl });
}

function verifierClient(actor: ActorConfig): VerifierManagementClient {
  if (!actor.verifierManagementUrl) {
    throw new Error(`actor ${actor.key} has no verifier management URL configured`);
  }
  return new VerifierManagementClient({ baseUrl: actor.verifierManagementUrl });
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Build and submit a verification, refusing first if the requesting role is not
 * entitled to the claims it is about to ask for.
 */
async function requestPresentation(options: {
  deps: ServiceDeps;
  actor: ActorConfig;
  definition: CredentialDefinition;
  queryId: string;
  claims: string[];
  purposeScope: string;
  purposeName: Record<string, string>;
  purposeDescription: Record<string, string>;
  acceptedIssuerDids: string[];
  /** Additional credential queries appended to the same presentation. */
  extraQueries?: { definition: CredentialDefinition; queryId: string; claims: string[]; acceptedIssuerDids: string[] }[];
}): Promise<VerificationStart> {
  const { deps, actor } = options;
  const interactionId = randomUUID();

  const plans = [
    { definition: options.definition, queryId: options.queryId, claims: options.claims, acceptedIssuerDids: options.acceptedIssuerDids },
    ...(options.extraQueries ?? []),
  ];

  for (const plan of plans) {
    // Beta-ID is issued by the Confederation's Beta Credential Service and has
    // no governance entry of ours; everything we define is checked.
    if (!plan.definition.governance) continue;
    const decision = reviewRequest({
      definition: plan.definition,
      role: actor.role,
      requestedClaims: plan.claims,
    });
    const record = recordDecision({
      interactionId,
      actorRole: actor.role,
      actorDid: actor.did,
      credentialType: plan.definition.vct,
      purposeScope: options.purposeScope,
      claimsReleased: decision.outcome === 'allow' ? plan.claims : [],
      decision: decision.outcome,
      reasons: decision.reasons,
      ...(plan.definition.governance.retention ? { retention: plan.definition.governance.retention } : {}),
    });
    deps.store.record(record);
    if (decision.outcome === 'deny') throw new GovernanceRefusal(decision, record);
  }

  const entitlementClaims = (plan: (typeof plans)[number]): string[] => {
    const entitlement = entitlementFor(plan.definition, actor.role);
    return entitlement?.protectedClaims ?? [];
  };

  const queries = plans.map((plan) =>
    credentialQuery({
      id: plan.queryId,
      definition: plan.definition,
      claims: plan.claims,
      acceptedIssuerDids: plan.acceptedIssuerDids,
      // Only pass the override for claims this role is actually entitled to;
      // the DCQL builder then refuses anything else on its own.
      protectedClaimsAuthorized: plan.claims
        .filter((claim) => PROTECTED_CLAIMS.includes(claim))
        .every((claim) => entitlementClaims(plan).includes(claim)),
    }),
  );

  const request: CreateVerificationRequest = {
    dcql_query: dcqlQuery(...queries),
    // Both are MUSTs of swiss-profile-verification.
    jwt_secured_authorization_request: true,
    response_mode: 'direct_post.jwt',
    accepted_issuer_dids: [...new Set(plans.flatMap((plan) => plan.acceptedIssuerDids))].filter(Boolean),
    verification_purpose: {
      scope: options.purposeScope,
      purpose_name: options.purposeName,
      purpose_description: options.purposeDescription,
    },
  };
  // Catch a profile violation here, ahead of an unexplained wallet refusal.
  assertVerificationRequest(request);

  const verification = await verifierClient(actor).createVerification(request);
  return {
    verificationId: verification.id,
    deeplink: verification.verification_deeplink ?? '',
    requested: plans.map((plan) => ({ credentialType: plan.definition.vct, claims: plan.claims })),
    purposeScope: options.purposeScope,
  };
}

/**
 * Refuse to issue before touching the issuer, and return the reasons so they
 * can be journalled alongside the issuance itself.
 */
function authoriseIssuance(
  deps: ServiceDeps,
  actor: ActorConfig,
  definition: CredentialDefinition,
): string[] {
  const decision = reviewIssuance(definition, actor.roles);
  if (decision.outcome === 'deny') {
    const record = recordDecision({
      interactionId: randomUUID(),
      actorRole: actor.role,
      actorDid: actor.did,
      credentialType: definition.vct,
      purposeScope: `ch.didas.health.issue.${definition.configurationId}`,
      claimsReleased: [],
      decision: 'deny',
      reasons: decision.reasons,
    });
    deps.store.record(record);
    throw new GovernanceRefusal(decision, record);
  }
  return decision.reasons;
}

/**
 * Send one of the project's declared verification queries.
 *
 * The claim lists live in `VERIFICATION_QUERIES`, because the same
 * objects generate the Verification Query Public Statements published to the
 * Trust Registry. A query that drifts from its published statement makes the
 * statement a false claim, so there is only one copy.
 */
function requestFromSpec(
  deps: ServiceDeps,
  actor: ActorConfig,
  spec: VerificationQuerySpec,
  issuers: Record<string, string[]>,
): Promise<VerificationStart> {
  const [first, ...rest] = spec.plans;
  if (!first) throw new Error(`verification query ${spec.scope} has no credential plans`);
  return requestPresentation({
    deps,
    actor,
    definition: first.definition,
    queryId: first.id,
    claims: first.claims,
    acceptedIssuerDids: issuers[first.id] ?? [],
    purposeScope: spec.scope,
    purposeName: spec.purposeName,
    purposeDescription: spec.purposeDescription,
    extraQueries: rest.map((plan) => ({
      definition: plan.definition,
      queryId: plan.id,
      claims: plan.claims,
      acceptedIssuerDids: issuers[plan.id] ?? [],
    })),
  });
}

/* --------------------------------------------------------------- insurer */

export class InsurerService {
  constructor(private readonly deps: ServiceDeps) {}

  /** Issue an insurance card into the patient's wallet. */
  async issueInsuranceCard(input: {
    givenName: string;
    familyName: string;
    birthDate: string;
    administrativeNumber: string;
    cardNumber: string;
    insuranceModel: string;
    coverage: string[];
  }): Promise<OfferResult> {
    const actor = this.deps.config.actors.insurer;
    const authorisation = authoriseIssuance(this.deps, actor, INSURANCE_CARD);
    const client = issuerClient(actor);
    const statusListUri = await this.deps.statusLists.uriFor(actor.key, client);

    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 1);

    const claims = {
      given_name: input.givenName,
      family_name: input.familyName,
      birth_date: input.birthDate,
      card_number: input.cardNumber,
      personal_administrative_number: input.administrativeNumber,
      insurer_name: actor.displayName,
      insurer_ber_number: '01509',
      insurance_model: input.insuranceModel,
      coverage: input.coverage,
      valid_from: isoDate(new Date()),
      expiry_date: isoDate(validUntil),
    };

    const offer = await client.createOffer({
      metadata_credential_supported_id: [INSURANCE_CARD.configurationId],
      credential_subject_data: claims,
      offer_validity_seconds: 86_400,
      credential_valid_from: new Date().toISOString(),
      credential_valid_until: validUntil.toISOString(),
      status_lists: [statusListUri],
    });

    const credential: IssuedCredential = {
      managementId: offer.management_id,
      configurationId: INSURANCE_CARD.configurationId,
      vct: INSURANCE_CARD.vct,
      label: 'Versichertenkarte',
      deeplink: offer.offer_deeplink,
      issuedAt: new Date().toISOString(),
      issuer: actor.displayName,
      status: 'OFFERED',
    };
    this.deps.store.addStandalone(credential);

    const record = recordDecision({
      interactionId: offer.management_id,
      actorRole: actor.role,
      actorDid: actor.did,
      credentialType: INSURANCE_CARD.vct,
      purposeScope: 'ch.didas.health.issue.insurance-card',
      claimsReleased: Object.keys(claims),
      decision: 'allow',
      reasons: [...authorisation, `revocable through status list ${statusListUri}`],
      ...(INSURANCE_CARD.governance?.retention ? { retention: INSURANCE_CARD.governance.retention } : {}),
    });
    this.deps.store.record(record);

    return { credential, record };
  }

  /** Suspend or revoke a card, e.g. when cover ends. */
  async setCardStatus(managementId: string, status: 'SUSPENDED' | 'REVOKED' | 'ISSUED'): Promise<void> {
    const actor = this.deps.config.actors.insurer;
    await issuerClient(actor).updateStatus(managementId, status);
    const credential = this.deps.store.findIssued(managementId);
    if (credential) credential.status = status;
    this.deps.store.record(
      recordDecision({
        interactionId: managementId,
        actorRole: actor.role,
        actorDid: actor.did,
        credentialType: INSURANCE_CARD.vct,
        purposeScope: 'ch.didas.health.lifecycle.insurance-card',
        claimsReleased: [],
        decision: 'allow',
        reasons: [`status set to ${status} by the issuer`],
      }),
    );
  }
}

/* ---------------------------------------------------------------- praxis */

export class PraxisService {
  constructor(private readonly deps: ServiceDeps) {}

  /**
   * Check-in: ask for identity and cover in one presentation.
   *
   * Two credentials from two different issuers, combined in a single DCQL
   * query, is the whole reception desk interaction — and the claim list is the
   * minimisation decision made visible. The practice asks for the AHV number
   * because it bills with it, and for nothing about the patient's health.
   */
  async startCheckIn(): Promise<{ encounter: Encounter; start: VerificationStart }> {
    const actor = this.deps.config.actors.praxis;
    const encounter = this.deps.store.createEncounter();

    const start = await requestFromSpec(this.deps, actor, CHECK_IN, {
      insurance_card: [this.deps.config.actors.insurer.did],
      // Identity comes from the Beta-ID, the Sandbox stand-in for the e-ID.
      // Asking the card for a name and the e-ID for the same name is the
      // point: one is a billing attribute, the other an identity claim backed
      // by the Confederation, and a mismatch is worth noticing.
      identity: [this.deps.config.betaIdIssuerDid],
    });

    encounter.checkInVerificationId = start.verificationId;
    return { encounter, start };
  }

  /** Read the check-in outcome and apply the trust policy to it. */
  async completeCheckIn(encounterId: string): Promise<{
    encounter: Encounter;
    verification: VerificationManagementResponse;
    decision: Decision;
  }> {
    const actor = this.deps.config.actors.praxis;
    const encounter = this.deps.store.getEncounter(encounterId);
    if (!encounter?.checkInVerificationId) {
      throw new Error(`encounter ${encounterId} has no check-in in progress`);
    }

    const verification = await verifierClient(actor).get(encounter.checkInVerificationId);
    if (verification.state === 'PENDING') {
      return { encounter, verification, decision: { outcome: 'deny', reasons: ['waiting for the patient'] } };
    }
    if (verification.state === 'FAILED') {
      encounter.stage = 'check-in-refused';
      encounter.refusal =
        verification.wallet_response?.error_description ??
        verification.wallet_response?.error_code ??
        'the presentation failed';
      this.deps.store.record(
        recordDecision({
          interactionId: verification.id,
          actorRole: actor.role,
          actorDid: actor.did,
          credentialType: INSURANCE_CARD.vct,
          purposeScope: 'ch.didas.health.checkin',
          claimsReleased: [],
          decision: 'deny',
          reasons: [encounter.refusal],
        }),
      );
      return { encounter, verification, decision: { outcome: 'deny', reasons: [encounter.refusal] } };
    }

    // Technical validity plus trust markers, per credential query.
    const policy: TrustPolicy = this.deps.config.trustPolicy;
    const reasons: string[] = [];
    for (const [queryId, evaluations] of Object.entries(verification.credential_evaluation ?? {})) {
      const decision = reviewPresentation(evaluations[0], policy);
      reasons.push(...decision.reasons.map((reason) => `${queryId}: ${reason}`));
      if (decision.outcome === 'deny') {
        encounter.stage = 'check-in-refused';
        encounter.refusal = decision.reasons.at(-1) ?? 'trust evaluation failed';
        const record = recordDecision({
          interactionId: verification.id,
          actorRole: actor.role,
          actorDid: actor.did,
          credentialType: queryId,
          purposeScope: 'ch.didas.health.checkin',
          claimsReleased: [],
          decision: 'deny',
          reasons,
        });
        this.deps.store.record(record);
        return { encounter, verification, decision: { outcome: 'deny', reasons } };
      }
    }

    const cover = disclosedClaims(verification, 'insurance_card') ?? {};
    const identity = disclosedClaims(verification, 'identity') ?? {};

    encounter.patient = {
      givenName: String(identity.given_name ?? cover.given_name ?? ''),
      familyName: String(identity.family_name ?? cover.family_name ?? ''),
      birthDate: String(identity.birth_date ?? cover.birth_date ?? ''),
    };
    encounter.cover = {
      insurerName: cover.insurer_name as string | undefined,
      insurerBerNumber: cover.insurer_ber_number as string | undefined,
      cardNumber: cover.card_number as string | undefined,
      coverage: cover.coverage as string[] | undefined,
      insuranceModel: cover.insurance_model as string | undefined,
      expiryDate: cover.expiry_date as string | undefined,
      administrativeNumber: cover.personal_administrative_number as string | undefined,
    };
    encounter.stage = 'checked-in';

    // Identity cross-check: the two credentials must agree about who this is.
    // Two issuers asserting the same person is exactly the value a trust
    // infrastructure adds over a card reader, so a mismatch is worth flagging.
    if (
      identity.family_name &&
      cover.family_name &&
      String(identity.family_name).toLowerCase() !== String(cover.family_name).toLowerCase()
    ) {
      reasons.push(
        `name on the insurance card (${String(cover.family_name)}) does not match the e-ID ` +
          `(${String(identity.family_name)}) — reception must resolve this manually`,
      );
    }

    this.deps.store.record(
      recordDecision({
        interactionId: verification.id,
        actorRole: actor.role,
        actorDid: actor.did,
        credentialType: `${INSURANCE_CARD.vct} + ${BETA_ID.vct}`,
        purposeScope: 'ch.didas.health.checkin',
        claimsReleased: [...Object.keys(cover), ...Object.keys(identity).map((name) => `identity.${name}`)],
        decision: 'allow',
        reasons,
        ...(INSURANCE_CARD.governance?.retention ? { retention: INSURANCE_CARD.governance.retention } : {}),
      }),
    );

    return { encounter, verification, decision: { outcome: 'allow', reasons } };
  }

  /** Issue the consultation's laboratory findings into the patient's wallet. */
  async issueLabReport(
    encounterId: string,
    findings: { loinc_code: string; analyte: string; value: string; unit: string; reference_range: string; flag: string }[],
    interpretation: string,
  ): Promise<OfferResult> {
    const encounter = this.requireCheckedIn(encounterId);
    const actor = this.deps.config.actors.praxis;
    const authorisation = authoriseIssuance(this.deps, actor, LAB_REPORT);
    const client = issuerClient(actor);
    const statusListUri = await this.deps.statusLists.uriFor(actor.key, client);

    const today = new Date();
    const validUntil = new Date(today);
    validUntil.setFullYear(validUntil.getFullYear() + 10);

    const claims = {
      report_id: `LAB-${Date.now()}`,
      patient_given_name: encounter.patient?.givenName ?? '',
      patient_family_name: encounter.patient?.familyName ?? '',
      patient_birth_date: encounter.patient?.birthDate ?? '',
      findings,
      interpretation,
      specimen_date: isoDate(today),
      report_date: isoDate(today),
      laboratory_name: `${actor.displayName} — DIDAS Praxislabor`,
      // Synthetic GLN. A real one comes from the Refdata index and its check
      // digit is validated by receiving systems.
      ordering_physician_gln: '7601000000001',
    };

    const offer = await client.createOffer({
      metadata_credential_supported_id: [LAB_REPORT.configurationId],
      credential_subject_data: claims,
      offer_validity_seconds: 86_400,
      credential_valid_from: today.toISOString(),
      credential_valid_until: validUntil.toISOString(),
      status_lists: [statusListUri],
    });

    return this.recordIssuance(encounter, LAB_REPORT, offer.management_id, offer.offer_deeplink, 'Laborbefund', Object.keys(claims), authorisation);
  }

  /** Issue a prescription into the patient's wallet. */
  async issuePrescription(
    encounterId: string,
    medication: { name: string; gtin?: string; dosage: string; quantity: number; substitution_allowed: boolean }[],
    repeats: number,
  ): Promise<OfferResult> {
    const encounter = this.requireCheckedIn(encounterId);
    const actor = this.deps.config.actors.praxis;
    const authorisation = authoriseIssuance(this.deps, actor, PRESCRIPTION);
    const client = issuerClient(actor);
    const statusListUri = await this.deps.statusLists.uriFor(actor.key, client);

    const today = new Date();
    // A Swiss prescription is valid for a year unless the prescriber says
    // otherwise; `exp` is set to the same date so an expired prescription
    // cannot be presented at all.
    const validUntil = new Date(today);
    validUntil.setFullYear(validUntil.getFullYear() + 1);

    const claims = {
      prescription_id: `RX-${Date.now()}`,
      patient_given_name: encounter.patient?.givenName ?? '',
      patient_family_name: encounter.patient?.familyName ?? '',
      patient_birth_date: encounter.patient?.birthDate ?? '',
      medication,
      prescriber_name: `Dr. med. DIDAS Muster, ${actor.displayName}`,
      prescriber_gln: '7601000000001',
      issued_date: isoDate(today),
      expiry_date: isoDate(validUntil),
      repeats_authorized: repeats,
    };

    const offer = await client.createOffer({
      metadata_credential_supported_id: [PRESCRIPTION.configurationId],
      credential_subject_data: claims,
      offer_validity_seconds: 86_400,
      credential_valid_from: today.toISOString(),
      credential_valid_until: validUntil.toISOString(),
      status_lists: [statusListUri],
    });

    return this.recordIssuance(encounter, PRESCRIPTION, offer.management_id, offer.offer_deeplink, 'Rezept', Object.keys(claims), authorisation);
  }

  /**
   * Record an administered vaccination into the patient's wallet.
   *
   * One dose, one credential. The practice attests what it did — which vaccine,
   * which lot, on which day, by whom — and then has no further hold over the
   * record. The patient's vaccination history is the set of dose credentials
   * they hold, assembled in the wallet under their own control.
   */
  async issueImmunization(
    encounterId: string,
    dose: {
      vaccine_code: string;
      vaccine_name: string;
      target_disease: string[];
      dose_number: number;
      doses_in_series: number;
      lot_number: string;
      route: string;
      site?: string;
      next_dose_due?: string;
    },
  ): Promise<OfferResult> {
    const encounter = this.requireCheckedIn(encounterId);
    const actor = this.deps.config.actors.praxis;
    const authorisation = authoriseIssuance(this.deps, actor, IMMUNIZATION);
    const client = issuerClient(actor);
    const statusListUri = await this.deps.statusLists.uriFor(actor.key, client);

    const today = new Date();
    // A vaccination record has no natural expiry — the event does not stop
    // having happened — so `exp` is set far out, which
    // the profile would otherwise leave to the wallet to interpret.
    const validUntil = new Date(today);
    validUntil.setFullYear(validUntil.getFullYear() + 50);

    const claims = {
      immunization_id: `IMM-${Date.now()}`,
      patient_given_name: encounter.patient?.givenName ?? '',
      patient_family_name: encounter.patient?.familyName ?? '',
      patient_birth_date: encounter.patient?.birthDate ?? '',
      vaccine_code: dose.vaccine_code,
      vaccine_name: dose.vaccine_name,
      target_disease: dose.target_disease,
      occurrence_date: isoDate(today),
      dose_number: dose.dose_number,
      doses_in_series: dose.doses_in_series,
      ...(dose.next_dose_due ? { next_dose_due: dose.next_dose_due } : {}),
      lot_number: dose.lot_number,
      route: dose.route,
      ...(dose.site ? { site: dose.site } : {}),
      performer_name: `Dr. med. DIDAS Muster, ${actor.displayName}`,
      performer_gln: '7601000000001',
      organization_name: actor.displayName,
      country: 'CH',
    };

    const offer = await client.createOffer({
      metadata_credential_supported_id: [IMMUNIZATION.configurationId],
      credential_subject_data: claims,
      offer_validity_seconds: 86_400,
      credential_valid_from: today.toISOString(),
      credential_valid_until: validUntil.toISOString(),
      status_lists: [statusListUri],
    });

    return this.recordIssuance(
      encounter,
      IMMUNIZATION,
      offer.management_id,
      offer.offer_deeplink,
      `Impfung: ${dose.vaccine_name}`,
      Object.keys(claims),
      authorisation,
    );
  }

  /**
   * Revoke a prescription the practice issued.
   *
   * Called by the pharmacy after dispensing. The practice is the issuer, so
   * only the practice can revoke — which is why redemption is a request between
   * two parties and not a database flag one of them can flip alone.
   */
  async revokePrescription(managementId: string, reason: string): Promise<void> {
    const actor = this.deps.config.actors.praxis;
    await issuerClient(actor).revoke(managementId);
    const credential = this.deps.store.findIssued(managementId);
    if (credential) credential.status = 'REVOKED';
    this.deps.store.record(
      recordDecision({
        interactionId: managementId,
        actorRole: actor.role,
        actorDid: actor.did,
        credentialType: PRESCRIPTION.vct,
        purposeScope: 'ch.didas.health.prescription.redeem',
        claimsReleased: [],
        decision: 'allow',
        reasons: [reason, 'status list bit set to INVALID; the credential can no longer be presented'],
      }),
    );
  }

  private requireCheckedIn(encounterId: string): Encounter {
    const encounter = this.deps.store.getEncounter(encounterId);
    if (!encounter) throw new Error(`unknown encounter ${encounterId}`);
    if (encounter.stage !== 'checked-in' && encounter.stage !== 'in-consultation') {
      throw new Error(`encounter ${encounterId} is ${encounter.stage}; issue only after a successful check-in`);
    }
    encounter.stage = 'in-consultation';
    return encounter;
  }

  private recordIssuance(
    encounter: Encounter,
    definition: CredentialDefinition,
    managementId: string,
    deeplink: string,
    label: string,
    claims: string[],
    authorisation: string[],
  ): OfferResult {
    const actor = this.deps.config.actors.praxis;
    const credential: IssuedCredential = {
      managementId,
      configurationId: definition.configurationId,
      vct: definition.vct,
      label,
      deeplink,
      issuedAt: new Date().toISOString(),
      issuer: actor.displayName,
      status: 'OFFERED',
    };
    encounter.issued.push(credential);

    const record = recordDecision({
      interactionId: managementId,
      actorRole: actor.role,
      actorDid: actor.did,
      credentialType: definition.vct,
      purposeScope: `ch.didas.health.issue.${definition.configurationId}`,
      claimsReleased: claims,
      decision: 'allow',
      reasons: [
        ...authorisation,
        `the practice keeps the treatment record; the credential itself lives in the patient's wallet`,
      ],
      ...(definition.governance?.retention ? { retention: definition.governance.retention } : {}),
    });
    this.deps.store.record(record);
    return { credential, record };
  }
}

/* -------------------------------------------------------------- pharmacy */

export class PharmacyService {
  constructor(private readonly deps: ServiceDeps) {}

  /** Ask the patient to present their prescription. */
  async startDispense(): Promise<VerificationStart> {
    const actor = this.deps.config.actors.pharmacy;
    return requestFromSpec(this.deps, actor, DISPENSE, {
      prescription: [this.deps.config.actors.praxis.did],
    });
  }

  async dispenseResult(verificationId: string): Promise<{
    verification: VerificationManagementResponse;
    decision: Decision;
    prescription?: Record<string, unknown>;
  }> {
    const actor = this.deps.config.actors.pharmacy;
    const verification = await verifierClient(actor).get(verificationId);

    if (verification.state === 'PENDING') {
      return { verification, decision: { outcome: 'deny', reasons: ['waiting for the patient'] } };
    }
    if (verification.state === 'FAILED') {
      const reason =
        verification.wallet_response?.error_description ??
        verification.wallet_response?.error_code ??
        'the presentation failed';
      this.deps.store.record(
        recordDecision({
          interactionId: verificationId,
          actorRole: actor.role,
          actorDid: actor.did,
          credentialType: PRESCRIPTION.vct,
          purposeScope: 'ch.didas.health.dispense',
          claimsReleased: [],
          decision: 'deny',
          reasons: [reason],
        }),
      );
      return { verification, decision: { outcome: 'deny', reasons: [reason] } };
    }

    const evaluation = verification.credential_evaluation?.['prescription']?.[0];
    const decision = reviewPresentation(evaluation, this.deps.config.trustPolicy);
    const prescription = disclosedClaims(verification, 'prescription');

    this.deps.store.record(
      recordDecision({
        interactionId: verificationId,
        actorRole: actor.role,
        actorDid: actor.did,
        credentialType: PRESCRIPTION.vct,
        purposeScope: 'ch.didas.health.dispense',
        claimsReleased: decision.outcome === 'allow' ? Object.keys(prescription ?? {}) : [],
        decision: decision.outcome,
        reasons: decision.reasons,
        ...(PRESCRIPTION.governance?.retention ? { retention: PRESCRIPTION.governance.retention } : {}),
      }),
    );

    return {
      verification,
      decision,
      ...(decision.outcome === 'allow' && prescription ? { prescription } : {}),
    };
  }
}

/* ---------------------------------------------------------- travel clinic */

/**
 * The minimisation showcase.
 *
 * A travel clinic asking "are you protected against yellow fever?" has no need
 * for the lot number, the vaccinating physician, the clinic, or the patient's
 * name — and under its entitlement it cannot obtain them even if its software
 * asks. Same credential, same wallet, a fraction of the data: this is what a
 * paper vaccination booklet handed across a counter cannot do.
 */
export class TravelClinicService {
  constructor(private readonly deps: ServiceDeps) {}

  async startCheck(): Promise<VerificationStart> {
    const actor = this.deps.config.actors.travelClinic;
    return requestFromSpec(this.deps, actor, IMMUNIZATION_STATUS, {
      immunization: [
        this.deps.config.actors.praxis.did,
        this.deps.config.actors.pharmacy.did,
      ],
    });
  }

  async result(verificationId: string): Promise<{
    verification: VerificationManagementResponse;
    decision: Decision;
    immunization?: Record<string, unknown>;
  }> {
    const actor = this.deps.config.actors.travelClinic;
    const verification = await verifierClient(actor).get(verificationId);

    if (verification.state === 'PENDING') {
      return { verification, decision: { outcome: 'deny', reasons: ['waiting for the patient'] } };
    }
    if (verification.state === 'FAILED') {
      const reason =
        verification.wallet_response?.error_description ??
        verification.wallet_response?.error_code ??
        'the presentation failed';
      this.deps.store.record(
        recordDecision({
          interactionId: verificationId,
          actorRole: actor.role,
          actorDid: actor.did,
          credentialType: IMMUNIZATION.vct,
          purposeScope: 'ch.didas.health.immunization.status',
          claimsReleased: [],
          decision: 'deny',
          reasons: [reason],
        }),
      );
      return { verification, decision: { outcome: 'deny', reasons: [reason] } };
    }

    const evaluation = verification.credential_evaluation?.['immunization']?.[0];
    const decision = reviewPresentation(evaluation, this.deps.config.trustPolicy);
    const immunization = disclosedClaims(verification, 'immunization');

    this.deps.store.record(
      recordDecision({
        interactionId: verificationId,
        actorRole: actor.role,
        actorDid: actor.did,
        credentialType: IMMUNIZATION.vct,
        purposeScope: 'ch.didas.health.immunization.status',
        claimsReleased: decision.outcome === 'allow' ? Object.keys(immunization ?? {}) : [],
        decision: decision.outcome,
        reasons: decision.reasons,
        ...(IMMUNIZATION.governance?.retention ? { retention: IMMUNIZATION.governance.retention } : {}),
      }),
    );

    return {
      verification,
      decision,
      ...(decision.outcome === 'allow' && immunization ? { immunization } : {}),
    };
  }
}

/**
 * The Beta-ID now lives in `@didas/swiyu` so the demo, the browser build and
 * the vqPS generator all describe it identically.
 */
export { BETA_ID_CREDENTIAL as betaIdDefinition };
