/**
 * Electronic prescription (eRezept / ordonnance électronique) issued by the
 * treating physician into the patient's wallet, and redeemed at a pharmacy.
 *
 * The medication list is a selectively disclosable array of objects, which the
 * Swiss Profile supports through recursive disclosures and array-element
 * disclosures — both of which it requires wallets to implement and recommends
 * using exactly here.
 */

import type { CredentialDefinition } from '../credential-definition.js';

export const PRESCRIPTION: CredentialDefinition = {
  configurationId: 'health_prescription_sd_jwt',
  vct: 'urn:vct:ch.didas.health.prescription:1.0',
  name: 'Swiss Electronic Prescription',
  displayName: {
    'de-CH': 'Rezept',
    'fr-CH': 'Ordonnance',
    'it-CH': 'Ricetta',
    'en-GB': 'Prescription',
  },
  description: {
    'de-CH': 'Elektronisches Rezept, ausgestellt durch die behandelnde Ärztin oder den behandelnden Arzt.',
    'fr-CH': 'Ordonnance électronique établie par le médecin traitant.',
    'it-CH': 'Ricetta elettronica rilasciata dal medico curante.',
    'en-GB': 'Electronic prescription issued by the treating physician.',
  },
  backgroundColor: '#1E7A4C',
  textColor: '#FFFFFF',
  primaryField: '{{medication[null].name.join(\', \')}}',
  secondaryField: '{{prescriber_name}}',
  // A prescription is a one-shot authorisation. Letting the wallet silently
  // re-fetch it from the credential endpoint would undermine the redemption
  // model, where the pharmacy revokes the credential once it is dispensed.
  refreshable: false,
  order: [
    'medication',
    'patient_given_name',
    'patient_family_name',
    'patient_birth_date',
    'prescriber_name',
    'prescriber_gln',
    'issued_date',
    'expiry_date',
    'repeats_authorized',
    'prescription_id',
  ],
  // Reuse of the clinical models without the central repository: the claims
  // below carry openEHR archetype paths and FHIR element paths, so a pharmacy
  // system can project the presented credential into the `MedicationRequest` it
  // already understands — or into an openEHR composition — without either side
  // operating a shared CDR. The model travels with the data; the data stays
  // with the patient.
  semantics: {
    openehr: {
      templateId: 'DIDAS.medication_order.v0',
      archetypeId: 'openEHR-EHR-INSTRUCTION.medication_order.v3',
    },
    fhir: {
      resourceType: 'MedicationRequest',
      profile: 'http://fhir.ch/ig/ch-emed/StructureDefinition/ch-emed-medicationrequest',
    },
  },
  governance: {
    issuerRole: 'ch.didas.health.role.practice',
    issuerBasis:
      'MedBG/LPMéd — only a person on the medical register may prescribe; the practice DID ' +
      'must carry a Governed Use Case Authorization Trust Marker naming this credential type',
    governed: true,
    revocation:
      'The pharmacy that dispenses asks the issuing practice to revoke, which is what makes ' +
      'the prescription single-use: redemption is a status change, not a note in a database ' +
      'the patient cannot see.',
    retention:
      'A pharmacy keeps the dispensation record under HMG/LPTh; the credential itself is not ' +
      'retained beyond the dispensation.',
    verifierRoles: [
      {
        role: 'ch.didas.health.role.pharmacy',
        purpose: 'Dispense the prescribed medication',
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
      {
        role: 'ch.didas.health.role.practice',
        purpose: 'Reconcile current medication during a follow-up consultation',
        claims: ['medication', 'issued_date', 'expiry_date', 'prescriber_gln'],
      },
    ],
  },
  claims: [
    {
      name: 'prescription_id',
      type: 'Text',
      required: true,
      label: {
        'de-CH': 'Rezeptnummer',
        'fr-CH': "Numéro d'ordonnance",
        'it-CH': 'Numero della ricetta',
        'en-GB': 'Prescription number',
      },
      schema: { type: 'string', minLength: 1, maxLength: 64 },
    },
    {
      name: 'patient_given_name',
      type: 'Text',
      required: true,
      label: { 'de-CH': 'Vorname(n)', 'fr-CH': 'Prénom(s)', 'it-CH': 'Nome(i)', 'en-GB': 'Given name(s)' },
      schema: { type: 'string', minLength: 1, maxLength: 200 },
    },
    {
      name: 'patient_family_name',
      type: 'Text',
      required: true,
      label: { 'de-CH': 'Name', 'fr-CH': 'Nom', 'it-CH': 'Cognome', 'en-GB': 'Surname' },
      schema: { type: 'string', minLength: 1, maxLength: 200 },
    },
    {
      name: 'patient_birth_date',
      type: 'DateTime',
      required: true,
      format: 'YYYY-MM-DD',
      label: {
        'de-CH': 'Geburtsdatum',
        'fr-CH': 'Date de naissance',
        'it-CH': 'Data di nascita',
        'en-GB': 'Date of birth',
      },
      schema: { type: 'string', format: 'date' },
    },
    {
      name: 'medication',
      type: 'Array[Reference]',
      required: true,
      label: {
        'de-CH': 'Medikamente',
        'fr-CH': 'Médicaments',
        'it-CH': 'Medicamenti',
        'en-GB': 'Medication',
      },
      schema: {},
      nested: [
        {
          name: 'name',
          type: 'Text',
          required: true,
          semantics: {
            openehr: {
              archetypeId: 'openEHR-EHR-INSTRUCTION.medication_order.v3',
              element: 'Medication item',
              path: 'medication_order/order/medication_item',
            },
            fhir: { path: 'MedicationRequest.medicationCodeableConcept.text' },
          },
          label: {
            'de-CH': 'Präparat',
            'fr-CH': 'Préparation',
            'it-CH': 'Preparato',
            'en-GB': 'Product',
          },
          schema: { type: 'string', minLength: 1, maxLength: 300 },
        },
        {
          /** Swissmedic GTIN of the dispensed pack. */
          name: 'gtin',
          type: 'Text',
          semantics: {
            openehr: {
              archetypeId: 'openEHR-EHR-CLUSTER.medication.v2',
              element: 'Name',
              path: 'medication_order/order/medication_details/name',
            },
            fhir: { path: 'MedicationRequest.medicationCodeableConcept.coding.code' },
            terminology: { system: 'https://www.gs1.org/gtin', code: 'GTIN' },
          },
          label: { 'de-CH': 'GTIN', 'fr-CH': 'GTIN', 'it-CH': 'GTIN', 'en-GB': 'GTIN' },
          schema: { type: 'string', pattern: '^[0-9]{13,14}$' },
        },
        {
          name: 'dosage',
          type: 'Text',
          required: true,
          semantics: {
            openehr: {
              archetypeId: 'openEHR-EHR-INSTRUCTION.medication_order.v3',
              element: 'Overall directions description',
              path: 'medication_order/order/overall_directions_description',
            },
            fhir: { path: 'MedicationRequest.dosageInstruction.text' },
          },
          label: {
            'de-CH': 'Dosierung',
            'fr-CH': 'Posologie',
            'it-CH': 'Posologia',
            'en-GB': 'Dosage',
          },
          schema: { type: 'string', minLength: 1, maxLength: 300 },
        },
        {
          name: 'quantity',
          type: 'Numeric',
          required: true,
          semantics: {
            openehr: {
              archetypeId: 'openEHR-EHR-INSTRUCTION.medication_order.v3',
              element: 'Dispense amount',
              path: 'medication_order/order/dispense_directions/dispense_amount',
            },
            fhir: { path: 'MedicationRequest.dispenseRequest.quantity.value' },
          },
          label: { 'de-CH': 'Menge', 'fr-CH': 'Quantité', 'it-CH': 'Quantità', 'en-GB': 'Quantity' },
          schema: { type: 'integer', minimum: 1, maximum: 1000 },
        },
        {
          name: 'substitution_allowed',
          type: 'Boolean',
          required: true,
          semantics: { fhir: { path: 'MedicationRequest.substitution.allowedBoolean' } },
          label: {
            'de-CH': 'Generika erlaubt',
            'fr-CH': 'Générique autorisé',
            'it-CH': 'Generico ammesso',
            'en-GB': 'Substitution allowed',
          },
          schema: { type: 'boolean' },
        },
      ],
    },
    {
      name: 'prescriber_name',
      type: 'Text',
      required: true,
      label: {
        'de-CH': 'Verordnende Person',
        'fr-CH': 'Prescripteur',
        'it-CH': 'Prescrittore',
        'en-GB': 'Prescriber',
      },
      schema: { type: 'string', minLength: 1, maxLength: 200 },
    },
    {
      /** GLN of the health professional, from the MedReg / Refdata index. */
      name: 'prescriber_gln',
      type: 'Text',
      required: true,
      semantics: {
        fhir: { path: 'MedicationRequest.requester.identifier.value' },
        terminology: { system: 'urn:oid:2.51.1.3', code: 'GLN', display: 'GS1 Global Location Number' },
      },
      label: { 'de-CH': 'GLN', 'fr-CH': 'GLN', 'it-CH': 'GLN', 'en-GB': 'GLN' },
      schema: { type: 'string', pattern: '^[0-9]{13}$' },
    },
    {
      name: 'issued_date',
      type: 'DateTime',
      required: true,
      semantics: { fhir: { path: 'MedicationRequest.authoredOn' } },
      format: 'YYYY-MM-DD',
      label: {
        'de-CH': 'Ausstellungsdatum',
        'fr-CH': "Date d'établissement",
        'it-CH': 'Data di rilascio',
        'en-GB': 'Date of issue',
      },
      schema: { type: 'string', format: 'date' },
    },
    {
      name: 'expiry_date',
      type: 'DateTime',
      required: true,
      format: 'YYYY-MM-DD',
      label: {
        'de-CH': 'Gültig bis',
        'fr-CH': "Valable jusqu'au",
        'it-CH': 'Valido fino al',
        'en-GB': 'Valid until',
      },
      schema: { type: 'string', format: 'date' },
    },
    {
      name: 'repeats_authorized',
      type: 'Numeric',
      required: true,
      label: {
        'de-CH': 'Wiederholungen',
        'fr-CH': 'Répétitions',
        'it-CH': 'Ripetizioni',
        'en-GB': 'Repeats',
      },
      schema: { type: 'integer', minimum: 0, maximum: 12 },
    },
  ],
};
