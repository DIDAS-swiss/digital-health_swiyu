/**
 * Demo state: encounters, issued credentials and the governance journal.
 *
 * In-memory on purpose. A practice management system would persist this, but
 * what it must persist is worth noticing: the encounter, what was asked for,
 * what was decided and why — not a second copy of the patient's credentials.
 * The wallet holds those.
 */

import { randomUUID } from 'node:crypto';

import type { GovernanceRecord } from '@didas/swiyu';

export type EncounterStage =
  | 'checking-in'
  | 'checked-in'
  | 'check-in-refused'
  | 'in-consultation'
  | 'closed';

export interface Encounter {
  id: string;
  stage: EncounterStage;
  createdAt: string;
  /** The check-in verification at the practice's verifier. */
  checkInVerificationId?: string;
  /** Claims the patient released at check-in, as far as the practice needs them. */
  patient?: {
    givenName?: string;
    familyName?: string;
    birthDate?: string;
  };
  cover?: {
    insurerName?: string;
    insurerBagNumber?: string;
    cardNumber?: string;
    coverage?: string[];
    insuranceModel?: string;
    expiryDate?: string;
    /** Present only when the practice was entitled to request it. */
    administrativeNumber?: string;
  };
  /** Why check-in was refused, when it was. */
  refusal?: string;
  issued: IssuedCredential[];
}

export interface IssuedCredential {
  managementId: string;
  configurationId: string;
  vct: string;
  label: string;
  deeplink: string;
  issuedAt: string;
  issuer: string;
  status: 'OFFERED' | 'ISSUED' | 'SUSPENDED' | 'REVOKED' | 'CANCELLED';
}

export class DemoStore {
  private readonly encounters = new Map<string, Encounter>();
  private readonly journal: GovernanceRecord[] = [];
  /** Credentials issued outside an encounter, e.g. the insurance card. */
  private readonly standalone: IssuedCredential[] = [];

  createEncounter(): Encounter {
    const encounter: Encounter = {
      id: randomUUID(),
      stage: 'checking-in',
      createdAt: new Date().toISOString(),
      issued: [],
    };
    this.encounters.set(encounter.id, encounter);
    return encounter;
  }

  getEncounter(id: string): Encounter | undefined {
    return this.encounters.get(id);
  }

  listEncounters(): Encounter[] {
    return [...this.encounters.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  addStandalone(credential: IssuedCredential): void {
    this.standalone.push(credential);
  }

  listStandalone(): IssuedCredential[] {
    return [...this.standalone];
  }

  /** Every issued credential, wherever it came from. */
  findIssued(managementId: string): IssuedCredential | undefined {
    for (const encounter of this.encounters.values()) {
      const found = encounter.issued.find((credential) => credential.managementId === managementId);
      if (found) return found;
    }
    return this.standalone.find((credential) => credential.managementId === managementId);
  }

  record(entry: GovernanceRecord): void {
    this.journal.push(entry);
  }

  listJournal(): GovernanceRecord[] {
    return [...this.journal].reverse();
  }

  reset(): void {
    this.encounters.clear();
    this.standalone.length = 0;
    this.journal.length = 0;
  }
}
