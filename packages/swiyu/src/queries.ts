/**
 * The verification queries this project sends — defined once.
 *
 * Each of these has to appear in two places that must not disagree: the
 * request the verifier actually sends, and the Verification Query Public
 * Statement published to the Trust Registry, which tells holders what this
 * verifier asks for and why. A vqPS that does not match the running query is
 * worse than none at all — it is a published claim that happens to be false.
 *
 * So the query lives here, the services build their requests from it, and
 * `scripts/vqps.ts` generates the submissions from the same object.
 */

import { BETA_ID_CREDENTIAL } from './credentials/beta-id.js';
import { IMMUNIZATION } from './credentials/immunization.js';
import { INSURANCE_CARD } from './credentials/insurance-card.js';
import { PRESCRIPTION } from './credentials/prescription.js';
import { ROLE, type Role } from './governance.js';
import type { CredentialDefinition } from './credential-definition.js';

export interface QueryPlan {
  /** DCQL credential query id; also the key the disclosed claims come back under. */
  id: string;
  definition: CredentialDefinition;
  claims: string[];
}

export interface VerificationQuerySpec {
  /** OpenID4VP scope, and the vqPS identifier for this query. */
  scope: string;
  /** The role that is entitled to send it. */
  role: Role;
  /**
   * Localised, `default` required. Max 40 characters per locale — the Trust
   * Registry's limit when the vqPS is published, tighter than the verifier's.
   */
  purposeName: Record<string, string>;
  /** Localised, `default` required. Max 500 characters per locale. */
  purposeDescription: Record<string, string>;
  plans: QueryPlan[];
}

/** Reception: identity from the Beta-ID, cover from the insurance card. */
export const CHECK_IN: VerificationQuerySpec = {
  scope: 'ch.didas.health.checkin',
  role: ROLE.practice,
  purposeName: {
    default: 'Check-in at the practice',
    'de': 'Anmeldung in der Praxis',
    'fr': 'Enregistrement au cabinet',
    'it': 'Registrazione presso lo studio',
  },
  purposeDescription: {
    default:
      'Confirms who you are and which insurance covers this consultation. No health data is requested.',
    'de':
      'Bestätigt Ihre Identität und Ihre Versicherungsdeckung für diese Konsultation. Es werden keine Gesundheitsdaten abgefragt.',
  },
  plans: [
    {
      id: 'insurance_card',
      definition: INSURANCE_CARD,
      claims: [
        'given_name',
        'family_name',
        'birth_date',
        'card_number',
        'insurer_name',
        'insurer_bag_number',
        'insurance_model',
        'coverage',
        'expiry_date',
        'personal_administrative_number',
      ],
    },
    {
      id: 'identity',
      definition: BETA_ID_CREDENTIAL,
      claims: ['given_name', 'family_name', 'birth_date'],
    },
  ],
};

/** The travel clinic: protection, and nothing else. */
export const IMMUNIZATION_STATUS: VerificationQuerySpec = {
  scope: 'ch.didas.health.immunization.status',
  role: ROLE.travelClinic,
  purposeName: {
    default: 'Check vaccination protection',
    'de': 'Impfschutz prüfen',
    'fr': 'Vérifier la protection vaccinale',
    'it': 'Verificare la protezione vaccinale',
  },
  purposeDescription: {
    default:
      'Asks only which diseases you are protected against and when — not the vaccine brand, the batch, or who vaccinated you.',
    'de':
      'Fragt nur, gegen welche Krankheiten Sie geschützt sind und seit wann — nicht den Impfstoff, die Charge oder wer Sie geimpft hat.',
  },
  plans: [
    {
      id: 'immunization',
      definition: IMMUNIZATION,
      claims: ['target_disease', 'occurrence_date', 'dose_number', 'doses_in_series'],
    },
  ],
};

/** The pharmacy, reading a prescription in order to dispense it. */
export const DISPENSE: VerificationQuerySpec = {
  scope: 'ch.didas.health.dispense',
  role: ROLE.pharmacy,
  purposeName: {
    default: 'Dispense prescribed medication',
    'de': 'Abgabe verordneter Medikamente',
    'fr': 'Remise des médicaments prescrits',
    'it': 'Consegna dei medicamenti prescritti',
  },
  purposeDescription: {
    default:
      'Reads your prescription so the medication can be handed over and the prescription used up.',
    'de':
      'Liest Ihr Rezept, damit die Medikamente abgegeben und das Rezept eingelöst werden kann.',
  },
  plans: [
    {
      id: 'prescription',
      definition: PRESCRIPTION,
      claims: [
        'prescription_id',
        'patient_given_name',
        'patient_family_name',
        'patient_birth_date',
        'medication',
        'prescriber_name',
        'prescriber_gln',
        'issued_date',
        'expiry_date',
        'repeats_authorized',
      ],
    },
  ],
};

export const VERIFICATION_QUERIES: readonly VerificationQuerySpec[] = [
  CHECK_IN,
  IMMUNIZATION_STATUS,
  DISPENSE,
];
