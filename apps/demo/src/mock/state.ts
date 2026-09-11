/**
 * In-memory state of the mock swiyu trust infrastructure.
 *
 * This stands in for three separate pieces of the real ecosystem: an issuer's
 * database of offers and credentials, the Base Registry's status lists, and the
 * Trust Registry's trust statements. Keeping them in one module makes the demo
 * runnable; keeping them behind the *same HTTP contract* as the real components
 * is what stops the demo from being a lie.
 */

import { randomUUID } from 'node:crypto';

import { TOKEN_STATUS, type CredentialStatusType, type DcqlQuery, type IssuerTrustMarker, type VerificationStatus } from '@didas/swiyu';

export interface MockStatusList {
  id: string;
  tenant: string;
  uri: string;
  bits: number;
  maxEntries: number;
  /** Index → status value, mirroring a Token Status List's bit array. */
  entries: Map<number, number>;
  nextIndex: number;
}

export interface MockCredential {
  managementId: string;
  offerId: string;
  tenant: string;
  issuerDid: string;
  configurationId: string;
  vct: string;
  claims: Record<string, unknown>;
  status: CredentialStatusType;
  preAuthorizedCode: string;
  statusListUri?: string;
  statusIndex?: number;
  validFrom?: string;
  validUntil?: string;
  createdAt: string;
}

export interface MockVerification {
  id: string;
  tenant: string;
  verifierDid: string;
  nonce: string;
  state: VerificationStatus;
  dcqlQuery: DcqlQuery;
  acceptedIssuerDids?: string[];
  purposeScope?: string;
  responseMode: string;
  jar: boolean;
  disclosed?: Record<string, Record<string, unknown>>;
  evaluation?: Record<string, { valid: boolean; status: number; markers: IssuerTrustMarker }[]>;
  errorCode?: string;
  errorDescription?: string;
  createdAt: string;
}

/** A credential as the simulated wallet holds it. */
export interface WalletCredential {
  id: string;
  vct: string;
  issuerDid: string;
  claims: Record<string, unknown>;
  statusListUri?: string;
  statusIndex?: number;
  receivedAt: string;
}

export class MockState {
  readonly statusLists = new Map<string, MockStatusList>();
  readonly credentials = new Map<string, MockCredential>();
  readonly verifications = new Map<string, MockVerification>();
  readonly wallet = new Map<string, WalletCredential>();

  /**
   * Trust statements, keyed by DID. The Trust Registry is the only reason a
   * verifier can say anything about who an issuer is, so the demo makes the
   * markers explicit and configurable, so a demo can withhold one and show the
   * refusal.
   */
  readonly trustMarkers = new Map<string, IssuerTrustMarker>();

  byPreAuthorizedCode(code: string): MockCredential | undefined {
    for (const credential of this.credentials.values()) {
      if (credential.preAuthorizedCode === code) return credential;
    }
    return undefined;
  }

  /** Allocate the next free index on a status list, as an issuer would. */
  allocateStatusIndex(uri: string): { uri: string; index: number } | undefined {
    for (const list of this.statusLists.values()) {
      if (list.uri !== uri) continue;
      if (list.nextIndex >= list.maxEntries) {
        throw new Error(`status list ${uri} is full (${list.maxEntries} entries)`);
      }
      const index = list.nextIndex;
      list.nextIndex += 1;
      list.entries.set(index, TOKEN_STATUS.VALID);
      return { uri, index };
    }
    return undefined;
  }

  setStatus(uri: string | undefined, index: number | undefined, value: number): void {
    if (uri === undefined || index === undefined) return;
    for (const list of this.statusLists.values()) {
      if (list.uri === uri) list.entries.set(index, value);
    }
  }

  readStatus(uri: string | undefined, index: number | undefined): number {
    if (uri === undefined || index === undefined) return TOKEN_STATUS.VALID;
    for (const list of this.statusLists.values()) {
      if (list.uri === uri) return list.entries.get(index) ?? TOKEN_STATUS.VALID;
    }
    return TOKEN_STATUS.VALID;
  }

  reset(): void {
    this.statusLists.clear();
    this.credentials.clear();
    this.verifications.clear();
    this.wallet.clear();
    this.trustMarkers.clear();
  }
}

export function newId(): string {
  return randomUUID();
}
