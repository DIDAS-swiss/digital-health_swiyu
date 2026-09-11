/**
 * JSON API behind the demo UI.
 *
 * Every route is a thin adapter: parse input, call the domain service, turn a
 * governance refusal into a 403 with its reasons intact. The reasons are the
 * interesting part of this demo, so they are never swallowed into a generic
 * error message.
 */

import type { FastifyInstance } from 'fastify';
import QRCode from 'qrcode';

import {
  ConformanceError,
  definitionByVct,
  ProtectedClaimError,
  projectToFhir,
  projectToOpenEhr,
  SwiyuApiError,
} from '@didas/swiyu';

import type { AppConfig } from '../config.js';
import {
  GovernanceRefusal,
  InsurerService,
  PharmacyService,
  PraxisService,
  TravelClinicService,
} from '../domain/services.js';
import type { DemoStore } from '../domain/store.js';

export interface ApiDeps {
  config: AppConfig;
  store: DemoStore;
  insurer: InsurerService;
  praxis: PraxisService;
  pharmacy: PharmacyService;
  travelClinic: TravelClinicService;
}

/** Render a deeplink as a data-URL QR code, which is how a wallet receives it. */
async function qr(deeplink: string): Promise<string> {
  return QRCode.toDataURL(deeplink, { errorCorrectionLevel: 'M', margin: 1, width: 320 });
}

export function registerApi(app: FastifyInstance, deps: ApiDeps): void {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof GovernanceRefusal) {
      return reply.code(403).send({
        error: 'governance_refusal',
        message: error.message,
        reasons: error.decision.reasons,
      });
    }
    if (error instanceof ProtectedClaimError) {
      return reply.code(403).send({ error: 'protected_claim', message: error.message, claims: error.claims });
    }
    if (error instanceof ConformanceError) {
      return reply.code(500).send({
        error: 'profile_violation',
        message: error.message,
        findings: error.findings,
      });
    }
    if (error instanceof SwiyuApiError) {
      return reply.code(502).send({
        error: 'swiyu_unavailable',
        message: error.message,
        detail: `${error.method} ${error.url} → ${error.status}`,
      });
    }
    app.log.error(error);
    const message = error instanceof Error ? error.message : String(error);
    return reply.code(500).send({ error: 'internal', message });
  });

  app.get('/api/config', async () => ({
    mode: deps.config.mode,
    trustPolicy: deps.config.trustPolicy,
    actors: Object.fromEntries(
      Object.entries(deps.config.actors).map(([key, actor]) => [
        key,
        { displayName: actor.displayName, role: actor.role, did: actor.did },
      ]),
    ),
  }));

  /* ------------------------------------------------------------- insurer */

  app.post<{
    Body: {
      givenName: string;
      familyName: string;
      birthDate: string;
      administrativeNumber: string;
      cardNumber: string;
      insuranceModel: string;
      coverage: string[];
    };
  }>('/api/insurer/insurance-card', async (request) => {
    const result = await deps.insurer.issueInsuranceCard(request.body);
    return { ...result, qr: await qr(result.credential.deeplink) };
  });

  app.post<{ Params: { managementId: string }; Body: { status: 'SUSPENDED' | 'REVOKED' | 'ISSUED' } }>(
    '/api/insurer/insurance-card/:managementId/status',
    async (request) => {
      await deps.insurer.setCardStatus(request.params.managementId, request.body.status);
      return { ok: true, status: request.body.status };
    },
  );

  /* -------------------------------------------------------------- praxis */

  app.post('/api/praxis/check-in', async () => {
    const { encounter, start } = await deps.praxis.startCheckIn();
    return { encounterId: encounter.id, ...start, qr: await qr(start.deeplink) };
  });

  app.get<{ Params: { encounterId: string } }>('/api/praxis/check-in/:encounterId', async (request) => {
    const { encounter, verification, decision } = await deps.praxis.completeCheckIn(request.params.encounterId);
    return { encounter, state: verification.state, decision };
  });

  app.post<{
    Params: { encounterId: string };
    Body: {
      findings: { loinc_code: string; analyte: string; value: string; unit: string; reference_range: string; flag: string }[];
      interpretation: string;
    };
  }>('/api/praxis/:encounterId/lab-report', async (request) => {
    const result = await deps.praxis.issueLabReport(
      request.params.encounterId,
      request.body.findings,
      request.body.interpretation,
    );
    return { ...result, qr: await qr(result.credential.deeplink) };
  });

  app.post<{
    Params: { encounterId: string };
    Body: {
      medication: { name: string; gtin?: string; dosage: string; quantity: number; substitution_allowed: boolean }[];
      repeats: number;
    };
  }>('/api/praxis/:encounterId/prescription', async (request) => {
    const result = await deps.praxis.issuePrescription(
      request.params.encounterId,
      request.body.medication,
      request.body.repeats,
    );
    return { ...result, qr: await qr(result.credential.deeplink) };
  });

  app.get('/api/praxis/encounters', async () => deps.store.listEncounters());

  app.post<{
    Params: { encounterId: string };
    Body: {
      vaccine_code: string;
      vaccine_name: string;
      target_disease: string[];
      dose_number: number;
      doses_in_series: number;
      lot_number: string;
      route: string;
      site?: string;
      next_dose_due?: string;
    };
  }>('/api/praxis/:encounterId/immunization', async (request) => {
    const result = await deps.praxis.issueImmunization(request.params.encounterId, request.body);
    return { ...result, qr: await qr(result.credential.deeplink) };
  });

  /* ------------------------------------------------------- travel clinic */

  app.post('/api/travel-clinic/check', async () => {
    const start = await deps.travelClinic.startCheck();
    return { ...start, qr: await qr(start.deeplink) };
  });

  app.get<{ Params: { verificationId: string } }>(
    '/api/travel-clinic/check/:verificationId',
    async (request) => {
      const result = await deps.travelClinic.result(request.params.verificationId);
      return {
        state: result.verification.state,
        decision: result.decision,
        immunization: result.immunization ?? null,
      };
    },
  );

  /* ------------------------------------------------------------ pharmacy */

  app.post('/api/pharmacy/dispense', async () => {
    const start = await deps.pharmacy.startDispense();
    return { ...start, qr: await qr(start.deeplink) };
  });

  app.get<{ Params: { verificationId: string } }>('/api/pharmacy/dispense/:verificationId', async (request) => {
    const result = await deps.pharmacy.dispenseResult(request.params.verificationId);
    return {
      state: result.verification.state,
      decision: result.decision,
      prescription: result.prescription ?? null,
    };
  });

  /**
   * Confirm the handover. The pharmacy asks the issuing practice to revoke,
   * which is what uses the prescription up.
   */
  app.post<{ Body: { prescriptionId: string } }>('/api/pharmacy/confirm', async (request) => {
    const issued = deps.store
      .listEncounters()
      .flatMap((encounter) => encounter.issued)
      .find((credential) => credential.managementId === request.body.prescriptionId);
    if (!issued) {
      return { ok: false, message: 'no such prescription was issued by this practice' };
    }
    await deps.praxis.revokePrescription(
      issued.managementId,
      'dispensed by the pharmacy; the prescription is used up',
    );
    return { ok: true };
  });

  /* --------------------------------------------------------- projections */

  /**
   * Project disclosed claims into FHIR and openEHR.
   *
   * This is what a practice or pharmacy system would do with the presentation
   * internally. Both projections are derived views of the signed credential,
   * and they only ever contain what the holder released.
   */
  app.post<{ Body: { vct: string; claims: Record<string, unknown> } }>('/api/projections', async (request) => {
    const definition = definitionByVct(request.body.vct);
    if (!definition) {
      return { error: `unknown credential type ${request.body.vct}` };
    }
    const result: Record<string, unknown> = { vct: definition.vct };
    if (definition.semantics?.fhir) {
      result.fhir = projectToFhir(definition, request.body.claims);
    }
    if (definition.semantics?.openehr) {
      result.openehr = projectToOpenEhr(definition, request.body.claims);
    }
    return result;
  });

  /* ------------------------------------------------------------ journal */

  app.get('/api/governance/journal', async () => deps.store.listJournal());

  app.post('/api/reset', async () => {
    deps.store.reset();
    return { ok: true };
  });
}
