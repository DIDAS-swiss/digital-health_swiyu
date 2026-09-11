/**
 * Wallet routes — mock mode only.
 *
 * In a real deployment there is nothing here: the wallet is an app on the
 * patient's phone, it scans the QR code, and the demo server never sees it.
 * These routes exist so the journey can be driven from one browser window, and
 * they are registered only when `SWIYU_MODE=mock` so they cannot accidentally
 * become part of a sandbox deployment.
 *
 * The one exception worth calling out is `/api/wallet/beta-id`, which issues a
 * stand-in Beta-ID. Against the Sandbox the patient gets a real Beta-ID from
 * the Confederation's Beta Credential Service instead, and this route is absent.
 */

import type { FastifyInstance } from 'fastify';

import { HttpClient } from '@didas/swiyu';

import { betaIdDefinition } from '../domain/services.js';

export interface WalletDeps {
  mockBaseUrl: string;
}

export function registerWalletRoutes(app: FastifyInstance, deps: WalletDeps): void {
  const mock = new HttpClient({ baseUrl: deps.mockBaseUrl });

  app.get('/api/wallet/credentials', async () => mock.get('/mock/wallet/credentials'));

  app.delete('/api/wallet/credentials', async () => mock.request('DELETE', '/mock/wallet/credentials'));

  /** Scan a credential offer QR. */
  app.post<{ Body: { deeplink: string } }>('/api/wallet/accept', async (request) =>
    mock.post('/mock/wallet/accept-offer', { deeplink: request.body.deeplink }),
  );

  /** Scan a verification QR, consenting or declining. */
  app.post<{ Body: { deeplink: string; consent?: boolean } }>('/api/wallet/present', async (request) =>
    mock.post('/mock/wallet/present', {
      deeplink: request.body.deeplink,
      consent: request.body.consent ?? true,
    }),
  );

  /**
   * Stand-in for the Beta Credential Service: issue a Beta-ID straight into the
   * simulated wallet so the identity half of check-in has something to answer
   * with.
   */
  app.post<{
    Body: { givenName: string; familyName: string; birthDate: string; administrativeNumber: string };
  }>('/api/wallet/beta-id', async (request) => {
    const offer = await mock.post<{ offer_deeplink: string }>('/tenant/bcs/management/api/credentials', {
      metadata_credential_supported_id: [betaIdDefinition.configurationId],
      credential_subject_data: {
        given_name: request.body.givenName,
        family_name: request.body.familyName,
        birth_date: request.body.birthDate,
        age_over_18: true,
        personal_administrative_number: request.body.administrativeNumber,
      },
      offer_validity_seconds: 3600,
    });
    return mock.post('/mock/wallet/accept-offer', { deeplink: offer.offer_deeplink });
  });
}
