/**
 * The whole patient journey, driven through the HTTP API.
 *
 * What this test proves and what it does not is worth being precise about. It
 * proves the business flow, the governance decisions and the credential
 * lifecycle. It does not prove protocol conformance: it runs against the
 * bundled mock, which performs no signing, no DPoP, no encryption and no DID
 * resolution. Conformance is the generic components' job, and is exercised
 * separately by the profile checks in the swiyu package.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { IMMUNIZATION, PRESCRIPTION } from '@didas/swiyu';

import { createApp, type StartedApp } from '../src/server.js';

let started: StartedApp;

const PATIENT = {
  givenName: 'DIDAS',
  familyName: 'Patient',
  birthDate: '1988-09-12',
  administrativeNumber: '756.1234.5678.97',
};

async function post(url: string, payload?: unknown): Promise<any> {
  const response = await started.app.inject({ method: 'POST', url, payload: payload ?? {} });
  return { status: response.statusCode, body: response.json() };
}

async function get(url: string): Promise<any> {
  const response = await started.app.inject({ method: 'GET', url });
  return { status: response.statusCode, body: response.json() };
}

/** Collect an offered credential into the simulated wallet. */
async function collect(deeplink: string) {
  const { status, body } = await post('/api/wallet/accept', { deeplink });
  expect(status, JSON.stringify(body)).toBe(200);
  return body;
}

/** Answer a pending verification. */
async function present(deeplink: string, consent = true) {
  const { body } = await post('/api/wallet/present', { deeplink, consent });
  return body;
}

async function checkedInEncounter(): Promise<string> {
  await post('/api/wallet/beta-id', PATIENT);
  const card = await post('/api/insurer/insurance-card', {
    ...PATIENT,
    cardNumber: '80756000000000000001',
    insuranceModel: 'STANDARD',
    coverage: ['KVG'],
  });
  await collect(card.body.credential.deeplink);

  const checkIn = await post('/api/praxis/check-in');
  await present(checkIn.body.deeplink);
  const result = await get(`/api/praxis/check-in/${checkIn.body.encounterId}`);
  expect(result.body.decision.outcome).toBe('allow');
  return checkIn.body.encounterId;
}

beforeAll(async () => {
  // Ports of its own so the suite never collides with a running dev server.
  started = await createApp({ port: 3199, mockPort: 8199 });
});

afterAll(async () => {
  await started.close();
});

beforeEach(async () => {
  await post('/api/reset');
  await started.app.inject({ method: 'DELETE', url: '/api/wallet/credentials' });
});

describe('check-in', () => {
  it('asks for identity and cover in one presentation, and for no health data', async () => {
    await post('/api/wallet/beta-id', PATIENT);
    const checkIn = await post('/api/praxis/check-in');
    const requested = checkIn.body.requested as { credentialType: string; claims: string[] }[];
    expect(requested.map((r) => r.credentialType).sort()).toEqual([
      'betaid-sdjwt',
      'urn:vct:ch.didas.health.insurance-card:1.0',
    ]);
    const allClaims = requested.flatMap((r) => r.claims);
    expect(allClaims).not.toContain('findings');
    expect(allClaims).not.toContain('medication');
  });

  it('combines two issuers into one encounter', async () => {
    const encounterId = await checkedInEncounter();
    const result = await get(`/api/praxis/check-in/${encounterId}`);
    expect(result.body.encounter.patient).toMatchObject({
      givenName: 'DIDAS',
      familyName: 'Patient',
    });
    expect(result.body.encounter.cover.insurerName).toContain('DIDAS');
    // The practice is entitled to the AHV number, so it receives it.
    expect(result.body.encounter.cover.administrativeNumber).toBe(PATIENT.administrativeNumber);
  });

  it('treats a declined request as a refusal, not an error', async () => {
    await post('/api/wallet/beta-id', PATIENT);
    const checkIn = await post('/api/praxis/check-in');
    await present(checkIn.body.deeplink, false);
    const result = await get(`/api/praxis/check-in/${checkIn.body.encounterId}`);
    expect(result.body.decision.outcome).toBe('deny');
    expect(result.body.encounter.stage).toBe('check-in-refused');
    expect(result.body.encounter.refusal).toContain('declined');
  });

  it('fails when the patient holds no insurance card', async () => {
    await post('/api/wallet/beta-id', PATIENT);
    const checkIn = await post('/api/praxis/check-in');
    const outcome = await present(checkIn.body.deeplink);
    expect(outcome.state).toBe('FAILED');
    expect(outcome.error).toBe('credential_missing_data');
  });
});

describe('immunization showcase', () => {
  it('issues one credential per administered dose', async () => {
    const encounterId = await checkedInEncounter();
    const dose = await post(`/api/praxis/${encounterId}/immunization`, {
      vaccine_code: '871895005',
      vaccine_name: 'dTpa-IPV combination vaccine',
      target_disease: ['Diphtheria', 'Tetanus', 'Pertussis', 'Poliomyelitis'],
      dose_number: 1,
      doses_in_series: 3,
      lot_number: 'S4021-B',
      route: 'IM',
    });
    expect(dose.body.credential.vct).toBe(IMMUNIZATION.vct);
    const held = await collect(dose.body.credential.deeplink);
    expect(held.claims.target_disease).toHaveLength(4);
  });

  it('gives the travel clinic four claims out of the eighteen the credential holds', async () => {
    const encounterId = await checkedInEncounter();
    const dose = await post(`/api/praxis/${encounterId}/immunization`, {
      vaccine_code: '871895005',
      vaccine_name: 'dTpa-IPV combination vaccine',
      target_disease: ['Tetanus', 'Pertussis'],
      dose_number: 1,
      doses_in_series: 3,
      lot_number: 'S4021-B',
      route: 'IM',
    });
    await collect(dose.body.credential.deeplink);

    const check = await post('/api/travel-clinic/check');
    expect(check.body.requested[0].claims).toEqual([
      'target_disease',
      'occurrence_date',
      'dose_number',
      'doses_in_series',
    ]);
    await present(check.body.deeplink);
    const result = await get(`/api/travel-clinic/check/${check.body.verificationId}`);

    expect(result.body.decision.outcome).toBe('allow');
    const disclosed = Object.keys(result.body.immunization).sort();
    expect(disclosed).toEqual(['dose_number', 'doses_in_series', 'occurrence_date', 'target_disease']);
    // The claims the clinic has no entitlement to never left the wallet.
    for (const withheld of ['lot_number', 'performer_name', 'patient_family_name', 'vaccine_name']) {
      expect(result.body.immunization).not.toHaveProperty(withheld);
    }
  });
});

describe('prescription lifecycle', () => {
  async function issuedPrescription(encounterId: string) {
    const rx = await post(`/api/praxis/${encounterId}/prescription`, {
      medication: [
        { name: 'Atorvastatin 20 mg', gtin: '7680620930015', dosage: '1 in the evening', quantity: 100, substitution_allowed: true },
      ],
      repeats: 2,
    });
    await collect(rx.body.credential.deeplink);
    return rx.body.credential;
  }

  it('is dispensed once and then cannot be dispensed again', async () => {
    const encounterId = await checkedInEncounter();
    const prescription = await issuedPrescription(encounterId);
    expect(prescription.vct).toBe(PRESCRIPTION.vct);

    const first = await post('/api/pharmacy/dispense');
    await present(first.body.deeplink);
    const firstResult = await get(`/api/pharmacy/dispense/${first.body.verificationId}`);
    expect(firstResult.body.decision.outcome).toBe('allow');
    expect(firstResult.body.prescription.medication[0].name).toContain('Atorvastatin');

    // Handing over revokes: redemption is a status change, not a local flag.
    const confirmed = await post('/api/pharmacy/confirm', { prescriptionId: prescription.managementId });
    expect(confirmed.body.ok).toBe(true);

    const second = await post('/api/pharmacy/dispense');
    const outcome = await present(second.body.deeplink);
    expect(outcome.error).toBe('credential_revoked');
    const secondResult = await get(`/api/pharmacy/dispense/${second.body.verificationId}`);
    expect(secondResult.body.decision.outcome).toBe('deny');
  });

  it('refuses issuance before a successful check-in', async () => {
    const { status, body } = await post('/api/praxis/does-not-exist/prescription', {
      medication: [{ name: 'X', dosage: '1', quantity: 1, substitution_allowed: false }],
      repeats: 0,
    });
    expect(status).toBe(500);
    expect(body.message).toContain('unknown encounter');
  });
});

describe('the governance journal', () => {
  it('records every decision without recording the claim values', async () => {
    const encounterId = await checkedInEncounter();
    await post(`/api/praxis/${encounterId}/immunization`, {
      vaccine_code: '871895005',
      vaccine_name: 'dTpa-IPV combination vaccine',
      target_disease: ['Tetanus'],
      dose_number: 1,
      doses_in_series: 3,
      lot_number: 'S4021-B',
      route: 'IM',
    });

    const journal = (await get('/api/governance/journal')).body as {
      purposeScope: string;
      claimsReleased: string[];
      decision: string;
      reasons: string[];
    }[];
    expect(journal.length).toBeGreaterThan(3);
    expect(journal.map((entry) => entry.purposeScope)).toContain('ch.didas.health.checkin');

    // Claim *names* are journalled; the AHV number itself must appear nowhere.
    const serialised = JSON.stringify(journal);
    expect(serialised).toContain('personal_administrative_number');
    expect(serialised).not.toContain(PATIENT.administrativeNumber);
    expect(serialised).not.toContain('S4021-B');
  });
});
