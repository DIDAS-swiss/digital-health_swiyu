/**
 * A mock of the swiyu generic components and of a holder wallet.
 *
 * It exists so the whole patient journey can be run, tested and demonstrated
 * without a business partner onboarding, a registered DID or a phone. Two rules
 * keep its limits visible:
 *
 *   1. The management endpoints reproduce the real contract of `swiyu-issuer`
 *      and `swiyu-verifier` exactly — same paths, same request and response
 *      shapes. Switching `SWIYU_MODE` to `sandbox` changes URLs, nothing else.
 *   2. Everything that only a real deployment can do is *absent*
 *      into looking real. There is no signing here, no DPoP, no encryption, no
 *      DID resolution, no did:webvh log. The mock exercises the business flow
 *      and the governance rules; it does not exercise the cryptography, and
 *      passing against it proves nothing about protocol conformance.
 *
 * The wallet endpoints under `/mock/wallet` have no counterpart in the real
 * ecosystem — a real wallet is an app on a phone — and are namespaced so they
 * can never be mistaken for part of the contract.
 */

import Fastify, { type FastifyInstance } from 'fastify';

import {
  TOKEN_STATUS,
  type CreateCredentialOfferRequest,
  type CreateVerificationRequest,
  type CredentialWithDeeplinkResponse,
  type DcqlCredential,
  type IssuerTrustMarker,
  type StatusList,
  type StatusListCreateRequest,
  type UpdateCredentialStatusRequestType,
  type VerificationManagementResponse,
} from '@didas/swiyu';

import { MockState, newId, type MockCredential, type WalletCredential } from './state.js';

export interface MockServerOptions {
  port: number;
  /** Maps a tenant key to the DID that tenant signs with. */
  tenantDids: Record<string, string>;
  /** Maps a configuration id to the `vct` it issues, mirroring issuer metadata. */
  configurationVcts: Record<string, string>;
  state?: MockState;
  logger?: boolean;
}

export interface MockServer {
  app: FastifyInstance;
  state: MockState;
  baseUrl: string;
  close(): Promise<void>;
}

export async function startMockServer(options: MockServerOptions): Promise<MockServer> {
  const state = options.state ?? new MockState();
  const app = Fastify({ logger: options.logger ?? false });
  const baseUrl = `http://127.0.0.1:${options.port}`;

  registerMockRoutes(app, { ...options, state, baseUrl });

  await app.listen({ port: options.port, host: '127.0.0.1' });
  return {
    app,
    state,
    baseUrl,
    close: () => app.close(),
  };
}

interface RouteContext extends MockServerOptions {
  state: MockState;
  baseUrl: string;
}

export function registerMockRoutes(app: FastifyInstance, context: RouteContext): void {
  const { state, baseUrl } = context;

  const didOf = (tenant: string): string => context.tenantDids[tenant] ?? `did:webvh:mock:${tenant}`;

  /* ------------------------------------------------ issuer management API */

  app.post<{ Params: { tenant: string }; Body: StatusListCreateRequest }>(
    '/tenant/:tenant/management/api/status-list',
    async (request, reply) => {
      const id = newId();
      const uri = `${baseUrl}/api/v1/statuslist/${id}.jwt`;
      state.statusLists.set(id, {
        id,
        tenant: request.params.tenant,
        uri,
        bits: request.body.config.bits,
        maxEntries: request.body.maxLength,
        entries: new Map(),
        nextIndex: 0,
      });
      const response: StatusList = {
        id,
        statusRegistryUrl: uri,
        maxListEntries: request.body.maxLength,
        remainingListEntries: request.body.maxLength,
        config: { bits: request.body.config.bits },
      };
      return reply.send(response);
    },
  );

  app.get<{ Params: { tenant: string; statusListId: string } }>(
    '/tenant/:tenant/management/api/status-list/:statusListId',
    async (request, reply) => {
      const list = state.statusLists.get(request.params.statusListId);
      if (!list) return reply.code(404).send({ message: 'status list not found' });
      return reply.send({
        id: list.id,
        statusRegistryUrl: list.uri,
        maxListEntries: list.maxEntries,
        remainingListEntries: list.maxEntries - list.nextIndex,
        config: { bits: list.bits },
      } satisfies StatusList);
    },
  );

  app.post<{ Params: { tenant: string; statusListId: string } }>(
    '/tenant/:tenant/management/api/status-list/:statusListId',
    async (request, reply) => {
      const list = state.statusLists.get(request.params.statusListId);
      if (!list) return reply.code(404).send({ message: 'status list not found' });
      // A real issuer would re-sign the status list token and PUT it to the
      // registry here. Nothing to do in the mock; the state is already current.
      return reply.send({
        id: list.id,
        statusRegistryUrl: list.uri,
        maxListEntries: list.maxEntries,
        remainingListEntries: list.maxEntries - list.nextIndex,
        config: { bits: list.bits },
      } satisfies StatusList);
    },
  );

  app.post<{ Params: { tenant: string }; Body: CreateCredentialOfferRequest }>(
    '/tenant/:tenant/management/api/credentials',
    async (request, reply) => {
      const tenant = request.params.tenant;
      const configurationId = request.body.metadata_credential_supported_id[0];
      if (!configurationId) {
        return reply.code(400).send('metadata_credential_supported_id must not be empty');
      }
      const vct = context.configurationVcts[configurationId];
      if (!vct) {
        return reply.code(400).send(`unknown credential configuration ${configurationId}`);
      }

      let statusAllocation: { uri: string; index: number } | undefined;
      const requestedList = request.body.status_lists?.[0];
      if (requestedList) {
        statusAllocation = state.allocateStatusIndex(requestedList);
        if (!statusAllocation) {
          return reply.code(400).send(`status list ${requestedList} has not been initialised`);
        }
      }

      const managementId = newId();
      const offerId = newId();
      const preAuthorizedCode = newId();
      const credential: MockCredential = {
        managementId,
        offerId,
        tenant,
        issuerDid: didOf(tenant),
        configurationId,
        vct,
        claims: request.body.credential_subject_data,
        status: 'OFFERED',
        preAuthorizedCode,
        ...(statusAllocation ? { statusListUri: statusAllocation.uri, statusIndex: statusAllocation.index } : {}),
        ...(request.body.credential_valid_from ? { validFrom: request.body.credential_valid_from } : {}),
        ...(request.body.credential_valid_until ? { validUntil: request.body.credential_valid_until } : {}),
        createdAt: new Date().toISOString(),
      };
      state.credentials.set(managementId, credential);

      // The real shape of an OID4VCI credential offer, carried by value in the
      // deeplink. `swiyu://` is one of the two schemes wallets must support.
      const offer = {
        credential_issuer: `${baseUrl}/tenant/${tenant}`,
        credential_configuration_ids: [configurationId],
        grants: {
          'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
            'pre-authorized_code': preAuthorizedCode,
          },
        },
      };
      const response: CredentialWithDeeplinkResponse = {
        management_id: managementId,
        offer_id: offerId,
        offer_deeplink: `swiyu://?credential_offer=${encodeURIComponent(JSON.stringify(offer))}`,
      };
      return reply.send(response);
    },
  );

  app.get<{ Params: { tenant: string; managementId: string } }>(
    '/tenant/:tenant/management/api/credentials/:managementId',
    async (request, reply) => {
      const credential = state.credentials.get(request.params.managementId);
      if (!credential) return reply.code(404).send({ message: 'credential not found' });
      return reply.send({
        id: credential.managementId,
        status: credential.status,
        metadata_credential_supported_id: [credential.configurationId],
        credential_valid_from: credential.validFrom,
        credential_valid_until: credential.validUntil,
      });
    },
  );

  app.patch<{
    Params: { tenant: string; managementId: string };
    Querystring: { credentialStatus: UpdateCredentialStatusRequestType };
  }>('/tenant/:tenant/management/api/credentials/:managementId/status', async (request, reply) => {
    const credential = state.credentials.get(request.params.managementId);
    if (!credential) return reply.code(404).send({ message: 'credential not found' });
    const next = request.query.credentialStatus;

    if (credential.status === 'REVOKED') {
      // Revocation is terminal in the real issuer too; a demo that let you undo
      // it would teach the wrong lesson about what revocation means.
      return reply.code(400).send('REVOKED is a final state and cannot be changed');
    }
    credential.status = next === 'CANCELLED' ? 'CANCELLED' : next;
    if (next === 'REVOKED') {
      state.setStatus(credential.statusListUri, credential.statusIndex, TOKEN_STATUS.INVALID);
    } else if (next === 'SUSPENDED') {
      state.setStatus(credential.statusListUri, credential.statusIndex, TOKEN_STATUS.SUSPENDED);
    } else if (next === 'ISSUED') {
      state.setStatus(credential.statusListUri, credential.statusIndex, TOKEN_STATUS.VALID);
    } else if (next === 'CANCELLED') {
      state.setStatus(credential.statusListUri, credential.statusIndex, TOKEN_STATUS.INVALID);
    }
    return reply.send({
      id: credential.managementId,
      status: credential.status,
      status_lists: credential.statusListUri ? [credential.statusListUri] : [],
    });
  });

  /* ---------------------------------------------- verifier management API */

  app.post<{ Params: { tenant: string }; Body: CreateVerificationRequest }>(
    '/tenant/:tenant/management/api/verifications',
    async (request, reply) => {
      const tenant = request.params.tenant;
      const id = newId();
      const nonce = newId();
      state.verifications.set(id, {
        id,
        tenant,
        verifierDid: didOf(tenant),
        nonce,
        state: 'PENDING',
        dcqlQuery: request.body.dcql_query,
        ...(request.body.accepted_issuer_dids ? { acceptedIssuerDids: request.body.accepted_issuer_dids } : {}),
        ...(request.body.verification_purpose ? { purposeScope: request.body.verification_purpose.scope } : {}),
        responseMode: request.body.response_mode ?? 'direct_post.jwt',
        jar: request.body.jwt_secured_authorization_request ?? false,
        createdAt: new Date().toISOString(),
      });

      const requestUri = `${baseUrl}/tenant/${tenant}/oid4vp/api/request-object/${id}`;
      const response: VerificationManagementResponse = {
        id,
        request_nonce: nonce,
        state: 'PENDING',
        verification_url: requestUri,
        verification_deeplink: `swiyu-verify://?client_id=${encodeURIComponent(
          `decentralized_identifier:${didOf(tenant)}`,
        )}&request_uri=${encodeURIComponent(requestUri)}`,
      };
      return reply.send(response);
    },
  );

  app.get<{ Params: { tenant: string; verificationId: string } }>(
    '/tenant/:tenant/management/api/verifications/:verificationId',
    async (request, reply) => {
      const verification = state.verifications.get(request.params.verificationId);
      if (!verification) return reply.code(404).send({ message: 'verification not found' });

      const response: VerificationManagementResponse = {
        id: verification.id,
        request_nonce: verification.nonce,
        state: verification.state,
        dcql_query: verification.dcqlQuery,
        ...(verification.evaluation
          ? {
              credential_evaluation: Object.fromEntries(
                Object.entries(verification.evaluation).map(([queryId, evaluations]) => [
                  queryId,
                  evaluations.map((evaluation) => ({
                    valid: evaluation.valid,
                    credential_status: {
                      valid: evaluation.status === TOKEN_STATUS.VALID,
                      status: evaluation.status,
                    },
                    trust_markers: evaluation.markers,
                  })),
                ]),
              ),
            }
          : {}),
        ...(verification.state === 'PENDING'
          ? {}
          : {
              wallet_response: {
                ...(verification.disclosed ? { credential_subject_data: verification.disclosed } : {}),
                ...(verification.errorCode ? { error_code: verification.errorCode } : {}),
                ...(verification.errorDescription ? { error_description: verification.errorDescription } : {}),
              },
            }),
      };
      return reply.send(response);
    },
  );

  /** The request object a wallet fetches after scanning the QR code. */
  app.get<{ Params: { tenant: string; verificationId: string } }>(
    '/tenant/:tenant/oid4vp/api/request-object/:verificationId',
    async (request, reply) => {
      const verification = state.verifications.get(request.params.verificationId);
      if (!verification) return reply.code(404).send({ message: 'verification not found' });
      // A real verifier returns a signed JAR (`application/oauth-authz-req+jwt`).
      // The mock returns the claims unsigned and says so, in place of
      // something that merely looks like a JWT.
      return reply.send({
        __mock__: 'unsigned; a real verifier returns a signed oauth-authz-req+jwt',
        client_id: `decentralized_identifier:${verification.verifierDid}`,
        response_type: 'vp_token',
        response_mode: verification.responseMode,
        nonce: verification.nonce,
        aud: 'https://self-issued.me/v2',
        dcql_query: verification.dcqlQuery,
      });
    },
  );

  /* ------------------------------------------------ trust registry (mock) */

  app.put<{ Params: { did: string }; Body: IssuerTrustMarker }>(
    '/mock/trust/:did',
    async (request, reply) => {
      state.trustMarkers.set(decodeURIComponent(request.params.did), request.body);
      return reply.send({ did: decodeURIComponent(request.params.did), markers: request.body });
    },
  );

  /* ---------------------------------------------------- simulated wallet */

  app.get('/mock/wallet/credentials', async (_request, reply) => {
    return reply.send(
      [...state.wallet.values()].map((credential) => ({
        ...credential,
        status: state.readStatus(credential.statusListUri, credential.statusIndex),
      })),
    );
  });

  app.delete('/mock/wallet/credentials', async (_request, reply) => {
    state.wallet.clear();
    return reply.send({ ok: true });
  });

  /** Scan a credential offer QR and collect the credential. */
  app.post<{ Body: { deeplink: string } }>('/mock/wallet/accept-offer', async (request, reply) => {
    const parsed = parseOfferDeeplink(request.body.deeplink);
    if (!parsed) return reply.code(400).send({ message: 'not a credential offer deeplink' });

    const credential = state.byPreAuthorizedCode(parsed.preAuthorizedCode);
    if (!credential) return reply.code(400).send({ message: 'unknown pre-authorized code' });
    if (credential.status !== 'OFFERED') {
      return reply.code(400).send({ message: `offer is ${credential.status}, not OFFERED` });
    }

    credential.status = 'ISSUED';
    const held: WalletCredential = {
      id: credential.managementId,
      vct: credential.vct,
      issuerDid: credential.issuerDid,
      claims: credential.claims,
      ...(credential.statusListUri ? { statusListUri: credential.statusListUri } : {}),
      ...(credential.statusIndex === undefined ? {} : { statusIndex: credential.statusIndex }),
      receivedAt: new Date().toISOString(),
    };
    state.wallet.set(held.id, held);
    return reply.send(held);
  });

  /** Scan a verification QR, decide, and answer it. */
  app.post<{ Body: { deeplink: string; consent?: boolean } }>(
    '/mock/wallet/present',
    async (request, reply) => {
      const verificationId = parseVerificationDeeplink(request.body.deeplink);
      if (!verificationId) return reply.code(400).send({ message: 'not a verification deeplink' });
      const verification = state.verifications.get(verificationId);
      if (!verification) return reply.code(404).send({ message: 'verification not found' });
      if (verification.state !== 'PENDING') {
        return reply.code(400).send({ message: `verification already ${verification.state}` });
      }

      // The holder declining is a first-class outcome with its own result.
      if (request.body.consent === false) {
        verification.state = 'FAILED';
        verification.errorCode = 'client_rejected';
        verification.errorDescription = 'The holder declined the verification request.';
        return reply.send({ state: verification.state, error: verification.errorCode });
      }

      const disclosed: Record<string, Record<string, unknown>> = {};
      const evaluation: NonNullable<typeof verification.evaluation> = {};

      for (const query of verification.dcqlQuery.credentials) {
        const match = selectCredential(state, query, verification.acceptedIssuerDids);
        if (!match) {
          verification.state = 'FAILED';
          verification.errorCode = 'credential_missing_data';
          verification.errorDescription = `no held credential satisfies query ${query.id}`;
          return reply.send({ state: verification.state, error: verification.errorCode });
        }

        const status = state.readStatus(match.statusListUri, match.statusIndex);
        const markers = state.trustMarkers.get(match.issuerDid) ?? {
          trust_method: 'TRUST_PROTOCOL_2_0',
          is_trusted: false,
        };
        evaluation[query.id] = [{ valid: status === TOKEN_STATUS.VALID, status, markers }];

        if (status !== TOKEN_STATUS.VALID) {
          verification.state = 'FAILED';
          verification.errorCode = status === TOKEN_STATUS.SUSPENDED ? 'credential_suspended' : 'credential_revoked';
          verification.errorDescription = `credential ${match.id} is not valid on its status list`;
          verification.evaluation = evaluation;
          return reply.send({ state: verification.state, error: verification.errorCode });
        }

        // Selective disclosure: only the claim paths the verifier asked for
        // leave the wallet. This is the single most important behaviour the
        // mock has to get right, because every privacy claim rests on it.
        disclosed[query.id] = discloseClaims(match.claims, query);
      }

      verification.disclosed = disclosed;
      verification.evaluation = evaluation;
      verification.state = 'SUCCESS';
      return reply.send({ state: verification.state, disclosed });
    },
  );

  app.get('/mock/health', async (_request, reply) => reply.send({ ok: true, mock: true }));
}

/* -------------------------------------------------------------- helpers */

export function parseOfferDeeplink(deeplink: string): { preAuthorizedCode: string } | undefined {
  const match = /credential_offer=([^&]+)/.exec(deeplink);
  if (!match?.[1]) return undefined;
  try {
    const offer = JSON.parse(decodeURIComponent(match[1])) as {
      grants?: Record<string, { 'pre-authorized_code'?: string }>;
    };
    const code = offer.grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']?.['pre-authorized_code'];
    return code ? { preAuthorizedCode: code } : undefined;
  } catch {
    return undefined;
  }
}

export function parseVerificationDeeplink(deeplink: string): string | undefined {
  const match = /request_uri=([^&]+)/.exec(deeplink);
  if (!match?.[1]) return undefined;
  const uri = decodeURIComponent(match[1]);
  return uri.split('/').pop();
}

function selectCredential(
  state: MockState,
  query: DcqlCredential,
  acceptedIssuerDids: string[] | undefined,
): WalletCredential | undefined {
  const wanted = query.meta?.vct_values ?? [];
  const authorities = query.trusted_authorities?.flatMap((authority) => authority.values) ?? [];
  for (const credential of state.wallet.values()) {
    if (wanted.length > 0 && !wanted.includes(credential.vct)) continue;
    if (acceptedIssuerDids && acceptedIssuerDids.length > 0 && !acceptedIssuerDids.includes(credential.issuerDid)) {
      continue;
    }
    if (authorities.length > 0 && !authorities.includes(credential.issuerDid)) continue;
    return credential;
  }
  return undefined;
}

/** Release exactly the claim paths the DCQL query names, and nothing else. */
function discloseClaims(claims: Record<string, unknown>, query: DcqlCredential): Record<string, unknown> {
  if (!query.claims || query.claims.length === 0) return { ...claims };
  const disclosed: Record<string, unknown> = {};
  for (const claim of query.claims) {
    const [root] = claim.path;
    if (typeof root !== 'string') continue;
    const value = claims[root];
    if (value === undefined) continue;
    if (claim.path.length === 1) {
      disclosed[root] = value;
      continue;
    }
    // A deeper path selects inside a nested object or array element.
    disclosed[root] = selectPath(value, claim.path.slice(1));
  }
  return disclosed;
}

function selectPath(value: unknown, path: (string | number | null)[]): unknown {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (head === null && Array.isArray(value)) {
    return value.map((element) => selectPath(element, rest));
  }
  if (typeof head === 'number' && Array.isArray(value)) {
    return selectPath(value[head], rest);
  }
  if (typeof head === 'string' && value && typeof value === 'object') {
    return selectPath((value as Record<string, unknown>)[head], rest);
  }
  return undefined;
}
