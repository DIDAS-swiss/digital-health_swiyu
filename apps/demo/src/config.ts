/**
 * Runtime configuration for the three demo actors.
 *
 * Each actor is a separate legal entity with its own DID and its own instance
 * of the swiyu generic components — that separation is the point of the
 * exercise, so it is expressed in configuration and never
 * flattened into one service.
 *
 * `SWIYU_MODE` decides where the management APIs live:
 *   - `mock`    — the bundled mock in `src/mock`, so the whole journey runs
 *                 offline without a business partner onboarding. Default.
 *   - `sandbox` — real `swiyu-issuer` / `swiyu-verifier` instances wired to the
 *                 swiyu Sandbox trust infrastructure.
 *
 * Nothing above the client layer knows which is which: the mock implements the
 * same HTTP contract, so "does it work against the real thing" reduces to
 * "are the URLs and DIDs right".
 */

import { BETA_ID, ROLE, SANDBOX, SANDBOX_HEALTH_POLICY, STRICT_HEALTH_POLICY, type TrustPolicy } from '@didas/swiyu';

export type SwiyuMode = 'mock' | 'sandbox';

export type ActorKey = 'insurer' | 'praxis' | 'pharmacy' | 'travelClinic';

export interface ActorConfig {
  key: ActorKey;
  displayName: string;
  /** Primary role, used when this actor requests a presentation. */
  role: string;
  /** Every role this actor is registered for; issuance is checked against these. */
  roles: string[];
  /** DID of this actor, as registered on the Base Registry. */
  did: string;
  /** Management API of this actor's `swiyu-issuer`, if it issues. */
  issuerManagementUrl?: string;
  /** Management API of this actor's `swiyu-verifier`, if it verifies. */
  verifierManagementUrl?: string;
}

export interface AppConfig {
  mode: SwiyuMode;
  port: number;
  mockPort: number;
  /** Base URL this demo is reachable at, for QR deeplinks in sandbox mode. */
  publicUrl: string;
  actors: Record<ActorKey, ActorConfig>;
  /**
   * DID accepted as the Beta-ID issuer. Defaults to the Beta Credential Service's
   * own DID, so a Sandbox deployment works without extra configuration and the
   * mock issues its stand-in Beta-ID under the same identity.
   */
  betaIdIssuerDid: string;
  trustRegistryUrl: string;
  /**
   * Trust policy applied to every presentation. The Sandbox default keeps the
   * profile's MUST rules and records the SHOULDs as waived, because Sandbox
   * actors have not been through identity onboarding. A production deployment
   * sets SWIYU_TRUST_POLICY=strict and means it.
   */
  trustPolicy: TrustPolicy;
}

function env(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function envInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) throw new Error(`${name} must be an integer, got ${value}`);
  return parsed;
}

/**
 * Values a caller may override — tests pin their own ports so they never
 * collide with a running dev server.
 *
 * These are taken *before* the actor URLs are derived, on purpose. Overriding
 * `mockPort` on an already-built config would leave the actors pointing at the
 * default port while the wallet routes talk to the overridden one, which is a
 * confusing way to spend an afternoon.
 */
export interface ConfigOverrides {
  mode?: SwiyuMode;
  port?: number;
  mockPort?: number;
}

export function loadConfig(overrides: ConfigOverrides = {}): AppConfig {
  const mode = overrides.mode ?? (env('SWIYU_MODE', 'mock') as SwiyuMode);
  if (mode !== 'mock' && mode !== 'sandbox') {
    throw new Error(`SWIYU_MODE must be "mock" or "sandbox", got ${mode}`);
  }
  const port = overrides.port ?? envInt('PORT', 3000);
  const mockPort = overrides.mockPort ?? envInt('MOCK_PORT', 8090);
  const mockBase = `http://127.0.0.1:${mockPort}`;

  // In mock mode every actor talks to the one mock server but under its own
  // tenant path, so offers and verifications stay attributed to an actor.
  const issuerUrl = (actor: string, fallbackEnv: string): string =>
    mode === 'mock' ? `${mockBase}/tenant/${actor}` : env(fallbackEnv, '');
  const verifierUrl = (actor: string, fallbackEnv: string): string =>
    mode === 'mock' ? `${mockBase}/tenant/${actor}` : env(fallbackEnv, '');

  // Placeholder DIDs for mock mode. In sandbox mode these MUST be the DIDs
  // created with the DID Toolbox and registered on the Base Registry — a
  // did:webvh, since CD-001 requires new DIDs to use that method.
  const demoDid = (actor: string): string =>
    `did:webvh:QmDemo${actor}:identifier-reg.trust-infra.swiyu-int.admin.ch:api:v1:did:00000000-0000-0000-0000-00000000000${actor.length}`;

  return {
    mode,
    port,
    mockPort,
    publicUrl: env('PUBLIC_URL', `http://localhost:${port}`),
    betaIdIssuerDid: env('BETA_ID_ISSUER_DID', BETA_ID.issuerDid),
    trustRegistryUrl: env('SWIYU_TRUST_REGISTRY_URL', SANDBOX.trustRegistry),
    trustPolicy: env('SWIYU_TRUST_POLICY', 'sandbox') === 'strict' ? STRICT_HEALTH_POLICY : SANDBOX_HEALTH_POLICY,
    actors: {
      insurer: {
        key: 'insurer',
        displayName: env('INSURER_NAME', 'DIDAS Krankenversicherung (Demo)'),
        role: ROLE.insurer,
        roles: [ROLE.insurer],
        did: env('INSURER_DID', demoDid('insurer')),
        issuerManagementUrl: issuerUrl('insurer', 'INSURER_ISSUER_URL'),
      },
      praxis: {
        key: 'praxis',
        displayName: env('PRAXIS_NAME', 'DIDAS Hausarztpraxis (Demo)'),
        role: ROLE.practice,
        // A family practice is also an authorised vaccinator and runs its own
        // practice laboratory, so it is registered for three roles.
        roles: [ROLE.practice, ROLE.vaccinator, ROLE.laboratory],
        did: env('PRAXIS_DID', demoDid('praxis')),
        issuerManagementUrl: issuerUrl('praxis', 'PRAXIS_ISSUER_URL'),
        verifierManagementUrl: verifierUrl('praxis', 'PRAXIS_VERIFIER_URL'),
      },
      pharmacy: {
        key: 'pharmacy',
        displayName: env('PHARMACY_NAME', 'DIDAS Apotheke (Demo)'),
        role: ROLE.pharmacy,
        roles: [ROLE.pharmacy, ROLE.vaccinator],
        did: env('PHARMACY_DID', demoDid('pharmacy')),
        verifierManagementUrl: verifierUrl('pharmacy', 'PHARMACY_VERIFIER_URL'),
      },
      // A verifier that never needs to know who vaccinated you, only that you
      // are protected. It exists in the demo to make the minimisation
      // difference visible in the run.
      travelClinic: {
        key: 'travelClinic',
        displayName: env('TRAVEL_CLINIC_NAME', 'DIDAS Reisemedizin (Demo)'),
        role: ROLE.travelClinic,
        roles: [ROLE.travelClinic],
        did: env('TRAVEL_CLINIC_DID', demoDid('travelclinic')),
        verifierManagementUrl: verifierUrl('travelClinic', 'TRAVEL_CLINIC_VERIFIER_URL'),
      },
    },
  };
}
