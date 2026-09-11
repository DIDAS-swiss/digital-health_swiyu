/**
 * Entry point: wires the three actors, starts the mock trust infrastructure
 * when running in mock mode, and serves the demo UI.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import formbody from '@fastify/formbody';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';

import { IMMUNIZATION, INSURANCE_CARD, LAB_REPORT, PRESCRIPTION } from '@didas/swiyu';

import { loadConfig, type AppConfig, type ConfigOverrides } from './config.js';
import {
  InsurerService,
  PharmacyService,
  PraxisService,
  TravelClinicService,
  betaIdDefinition,
} from './domain/services.js';
import { StatusListPool } from './domain/status-lists.js';
import { DemoStore } from './domain/store.js';
import { startMockServer, type MockServer } from './mock/server.js';
import { registerApi } from './routes/api.js';
import { registerWalletRoutes } from './routes/wallet.js';
import { renderPage } from './ui/page.js';

const here = dirname(fileURLToPath(import.meta.url));

export interface StartedApp {
  app: FastifyInstance;
  config: AppConfig;
  store: DemoStore;
  mock?: MockServer;
  close(): Promise<void>;
}

/**
 * Credential configuration ids the mock issuer knows about. In sandbox mode the
 * real issuer reads the same mapping from the generated issuer metadata, so the
 * two stay in step through the credential definitions.
 */
function configurationVcts(): Record<string, string> {
  return Object.fromEntries(
    [IMMUNIZATION, INSURANCE_CARD, PRESCRIPTION, LAB_REPORT, betaIdDefinition].map((definition) => [
      definition.configurationId,
      definition.vct,
    ]),
  );
}

export async function createApp(overrides: ConfigOverrides = {}): Promise<StartedApp> {
  const config = loadConfig(overrides);
  const store = new DemoStore();
  const statusLists = new StatusListPool();

  let mock: MockServer | undefined;
  if (config.mode === 'mock') {
    mock = await startMockServer({
      port: config.mockPort,
      tenantDids: {
        insurer: config.actors.insurer.did,
        praxis: config.actors.praxis.did,
        pharmacy: config.actors.pharmacy.did,
        travelClinic: config.actors.travelClinic.did,
        bcs: config.betaIdIssuerDid,
      },
      configurationVcts: configurationVcts(),
    });

    // Seed the mock trust registry. The practice and the pharmacy carry full
    // markers; the insurer deliberately does not carry the Compliant Actor
    // marker, so the strict policy refuses it and the Sandbox policy records
    // the waiver — a demo where everything is trusted teaches nothing.
    const fullyTrusted = {
      trust_method: 'TRUST_PROTOCOL_2_0' as const,
      is_trusted: true,
      viTM: true,
      caTM: true,
      gucTM: true,
      gucaTM: true,
    };
    mock.state.trustMarkers.set(config.actors.praxis.did, fullyTrusted);
    mock.state.trustMarkers.set(config.actors.pharmacy.did, fullyTrusted);
    mock.state.trustMarkers.set(config.actors.travelClinic.did, fullyTrusted);
    mock.state.trustMarkers.set(config.actors.insurer.did, {
      ...fullyTrusted,
      caTM: false,
      viTM: true,
    });
    mock.state.trustMarkers.set(config.betaIdIssuerDid, fullyTrusted);
  }

  const deps = { config, store, statusLists };
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
  await app.register(formbody);
  await app.register(fastifyStatic, {
    root: join(here, '..', 'public'),
    prefix: '/static/',
  });

  registerApi(app, {
    config,
    store,
    insurer: new InsurerService(deps),
    praxis: new PraxisService(deps),
    pharmacy: new PharmacyService(deps),
    travelClinic: new TravelClinicService(deps),
  });

  if (mock) registerWalletRoutes(app, { mockBaseUrl: mock.baseUrl });

  app.get('/', async (_request, reply) => {
    reply.type('text/html; charset=utf-8');
    return renderPage(config);
  });

  return {
    app,
    config,
    store,
    ...(mock ? { mock } : {}),
    async close() {
      await app.close();
      if (mock) await mock.close();
    },
  };
}

const isEntryPoint = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isEntryPoint) {
  const started = await createApp();
  await started.app.listen({ port: started.config.port, host: '0.0.0.0' });
  started.app.log.info(
    `digital-health_swiyu demo on http://localhost:${started.config.port} ` +
      `(SWIYU_MODE=${started.config.mode})`,
  );
  if (started.config.mode === 'mock') {
    started.app.log.warn(
      'Running against the bundled mock. No signing, no DPoP, no encryption, no DID resolution — ' +
        'the business flow and the governance rules are exercised, the cryptography is not.',
    );
  }
}
