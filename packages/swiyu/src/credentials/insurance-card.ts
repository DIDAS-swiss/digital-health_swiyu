/**
 * Swiss health insurance card (Versichertenkarte / carte d'assuré) as a
 * verifiable credential, issued by the health insurer.
 *
 * This is the credential that replaces the plastic card the patient hands over
 * at reception. Its claims follow the data set printed on the physical card
 * under the KVG/LAMal ordinance (VVK), so a practice management system can map
 * it onto the fields it already has.
 */

import type { CredentialDefinition } from '../credential-definition.js';

export const INSURANCE_CARD: CredentialDefinition = {
  configurationId: 'health_insurance_card_sd_jwt',
  vct: 'urn:vct:ch.didas.health.insurance-card:1.0',
  name: 'Swiss Health Insurance Card',
  displayName: {
    'de-CH': 'Versichertenkarte',
    'fr-CH': "Carte d'assuré",
    'it-CH': 'Tessera di assicurato',
    'en-GB': 'Health Insurance Card',
  },
  description: {
    'de-CH': 'Elektronische Versichertenkarte der obligatorischen Krankenpflegeversicherung.',
    'fr-CH': "Carte d'assuré électronique de l'assurance obligatoire des soins.",
    'it-CH': "Tessera di assicurato elettronica dell'assicurazione obbligatoria delle cure medico-sanitarie.",
    'en-GB': 'Electronic insurance card for Swiss mandatory health insurance.',
  },
  backgroundColor: '#0B5D8F',
  textColor: '#FFFFFF',
  primaryField: '{{given_name}} {{family_name}}',
  secondaryField: '{{insurer_name}}',
  refreshable: true,
  order: [
    'given_name',
    'family_name',
    'birth_date',
    'insurer_name',
    'insurance_model',
    'coverage',
    'card_number',
    'insurer_bag_number',
    'valid_from',
    'expiry_date',
    'personal_administrative_number',
  ],
  // Administrative cover, so FHIR `Coverage` is the natural model. There is no
  // openEHR archetype for insurance cover — openEHR models the clinical record,
  // not the billing relationship — and inventing one would be worse than
  // pointing at the standard that already covers it.
  semantics: {
    fhir: { resourceType: 'Coverage', profile: 'http://fhir.ch/ig/ch-core/StructureDefinition/ch-core-coverage' },
  },
  governance: {
    issuerRole: 'ch.didas.health.role.insurer',
    issuerBasis: 'KVG/LAMal Art. 42a — the insurer issues the insurance card',
    governed: true,
    revocation:
      'The insurer revokes on termination of cover or card replacement; the status list bit ' +
      'flips and every later presentation fails without the patient having to return anything.',
    retention:
      'A practice may keep the disclosed claims for as long as the billing record requires ' +
      '(10 years under OR Art. 958f); a pharmacy only for the duration of the dispensation.',
    verifierRoles: [
      {
        role: 'ch.didas.health.role.practice',
        purpose: 'Establish cover and billing route at check-in',
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
        // A practice bills through the AHV number, so it is one of the few
        // roles that genuinely needs the protected field. The entitlement is
        // written down here precisely so that it is reviewable.
        protectedClaims: ['personal_administrative_number'],
      },
      {
        role: 'ch.didas.health.role.pharmacy',
        purpose: 'Confirm cover before dispensing a reimbursed medication',
        claims: ['insurer_name', 'insurer_bag_number', 'coverage', 'expiry_date'],
      },
    ],
  },
  claims: [
    {
      name: 'given_name',
      type: 'Text',
      required: true,
      label: { 'de-CH': 'Vorname(n)', 'fr-CH': 'Prénom(s)', 'it-CH': 'Nome(i)', 'en-GB': 'Given name(s)' },
      schema: { type: 'string', minLength: 1, maxLength: 200 },
    },
    {
      name: 'family_name',
      type: 'Text',
      required: true,
      label: { 'de-CH': 'Name', 'fr-CH': 'Nom', 'it-CH': 'Cognome', 'en-GB': 'Surname' },
      schema: { type: 'string', minLength: 1, maxLength: 200 },
    },
    {
      name: 'birth_date',
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
      /**
       * The 20-digit VeKa card number (`80756...`), printed on the physical
       * card. It identifies the card; the AHV number identifies the person.
       */
      name: 'card_number',
      type: 'Text',
      required: true,
      semantics: { fhir: { path: 'Coverage.identifier.value' } },
      label: {
        'de-CH': 'Kartennummer',
        'fr-CH': 'Numéro de carte',
        'it-CH': 'Numero della tessera',
        'en-GB': 'Card number',
      },
      schema: { type: 'string', pattern: '^807[0-9]{17}$' },
    },
    {
      /**
       * The AHV/AVS number. swiss-profile-trust 1.0 lists
       * `personal_administrative_number` as a **protected field**: a verifier
       * needs a Governed Use Case Authorization Trust Marker to request it,
       * whatever credential type carries it. Treating the Swiss social security
       * number this way is the whole point of the protected-field mechanism, so
       * the demo uses the profile's claim name.
       */
      name: 'personal_administrative_number',
      type: 'Text',
      required: true,
      sensitive: true,
      semantics: {
        fhir: { path: 'Coverage.beneficiary.identifier.value' },
        terminology: { system: 'urn:oid:2.16.756.5.32', code: 'AHVN13' },
      },
      label: {
        'de-CH': 'AHV-Nummer',
        'fr-CH': 'Numéro AVS',
        'it-CH': 'Numero AVS',
        'en-GB': 'Social security number',
      },
      schema: { type: 'string', pattern: '^756\\.[0-9]{4}\\.[0-9]{4}\\.[0-9]{2}$' },
    },
    {
      name: 'insurer_name',
      type: 'Text',
      required: true,
      semantics: { fhir: { path: 'Coverage.payor.display' } },
      label: { 'de-CH': 'Versicherer', 'fr-CH': 'Assureur', 'it-CH': 'Assicuratore', 'en-GB': 'Insurer' },
      schema: { type: 'string', minLength: 1, maxLength: 200 },
    },
    {
      /** The insurer's five-digit BAG/OFSP registration number. */
      name: 'insurer_bag_number',
      type: 'Text',
      required: true,
      semantics: {
        fhir: { path: 'Coverage.payor.identifier.value' },
        terminology: { system: 'urn:oid:2.16.756.5.45', code: 'BAG-Nummer' },
      },
      label: {
        'de-CH': 'BAG-Nummer',
        'fr-CH': 'Numéro OFSP',
        'it-CH': 'Numero UFSP',
        'en-GB': 'Insurer registration number',
      },
      schema: { type: 'string', pattern: '^[0-9]{4,5}$' },
    },
    {
      name: 'insurance_model',
      type: 'Text',
      required: true,
      label: { 'de-CH': 'Modell', 'fr-CH': 'Modèle', 'it-CH': 'Modello', 'en-GB': 'Model' },
      schema: { type: 'string', enum: ['STANDARD', 'HMO', 'HAUSARZT', 'TELMED'] },
    },
    {
      /** KVG is the mandatory basic cover, VVG the supplementary one. */
      name: 'coverage',
      type: 'Array[Text]',
      required: true,
      semantics: { fhir: { path: 'Coverage.type.coding.code' } },
      label: { 'de-CH': 'Deckung', 'fr-CH': 'Couverture', 'it-CH': 'Copertura', 'en-GB': 'Coverage' },
      schema: {
        type: 'array',
        minItems: 1,
        items: { type: 'string', enum: ['KVG', 'VVG', 'UVG'] },
      },
    },
    {
      name: 'valid_from',
      type: 'DateTime',
      required: true,
      semantics: { fhir: { path: 'Coverage.period.start' } },
      format: 'YYYY-MM-DD',
      label: { 'de-CH': 'Gültig ab', 'fr-CH': 'Valable dès', 'it-CH': 'Valido dal', 'en-GB': 'Valid from' },
      schema: { type: 'string', format: 'date' },
    },
    {
      /**
       * Business expiry. swiss-profile-vc keeps this distinct from `exp`: after
       * `expiry_date` the wallet only warns the holder and the verifier decides,
       * while after `exp` the credential cannot be presented at all.
       */
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
  ],
};
