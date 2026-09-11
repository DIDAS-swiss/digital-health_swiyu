/**
 * Immunization record as a verifiable credential — the showcase case.
 *
 * Switzerland has tried the centralised version of this. `meineimpfungen.ch`
 * held the national electronic vaccination record until it was shut down in
 * 2021 after serious security failures, and several hundred thousand people
 * lost access to their own vaccination history at once. That is the failure
 * mode this architecture is meant to avoid: not a bad database, but a design in
 * which one database existing at all is a single point of failure for everyone.
 *
 * Here the record is a credential in the patient's wallet. Nobody operates a
 * registry that can be breached or switched off, and the vaccination history
 * survives its issuers — a practice that closes, a pharmacy chain that is sold,
 * a platform that is wound up. What is reused from the centralised world is the
 * part worth reusing: the information models. The claims below carry FHIR
 * element paths (CH VACD, and the International Patient Summary profile that
 * roadmap step 2 builds on) and openEHR archetype paths, so any system that
 * already speaks either can read a presented credential.
 *
 * Each administered dose is its own credential. That is deliberate: a dose is
 * an event, issued by whoever administered it, revocable by them alone if it
 * was recorded in error, and independently presentable. A wallet holding four
 * dose credentials is a vaccination record — without anyone having to own the
 * record itself.
 */

import type { CredentialDefinition } from '../credential-definition.js';

export const IMMUNIZATION: CredentialDefinition = {
  configurationId: 'health_immunization_sd_jwt',
  vct: 'urn:vct:ch.didas.health.immunization:1.0',
  name: 'Immunization Record',
  displayName: {
    'de-CH': 'Impfeintrag',
    'fr-CH': 'Vaccination',
    'it-CH': 'Vaccinazione',
    'en-GB': 'Immunization',
  },
  description: {
    'de-CH': 'Nachweis einer verabreichten Impfung, ausgestellt durch die impfende Stelle.',
    'fr-CH': "Preuve d'une vaccination administrée, délivrée par le vaccinateur.",
    'it-CH': 'Prova di una vaccinazione somministrata, rilasciata da chi la somministra.',
    'en-GB': 'Proof of one administered vaccination, issued by whoever administered it.',
  },
  backgroundColor: '#0F6E8C',
  textColor: '#FFFFFF',
  primaryField: '{{vaccine_name}}',
  secondaryField: '{{occurrence_date}}',
  // A vaccination that happened stays happened. Nothing about the event changes
  // later, so there is nothing for a refresh to fetch.
  refreshable: false,
  order: [
    'vaccine_name',
    'target_disease',
    'occurrence_date',
    'dose_number',
    'doses_in_series',
    'next_dose_due',
    'patient_given_name',
    'patient_family_name',
    'patient_birth_date',
    'performer_name',
    'performer_gln',
    'organization_name',
    'vaccine_code',
    'lot_number',
    'route',
    'site',
    'country',
    'immunization_id',
  ],
  semantics: {
    openehr: {
      templateId: 'DIDAS.immunisation.v0',
      archetypeId: 'openEHR-EHR-ACTION.medication.v1',
    },
    fhir: {
      resourceType: 'Immunization',
      // The CH VACD profile for national use; roadmap step 2 additionally
      // conforms these to Immunization-uv-ips for the patient summary.
      profile: 'http://fhir.ch/ig/ch-vacd/StructureDefinition/ch-vacd-immunization',
    },
  },
  governance: {
    issuerRole: 'ch.didas.health.role.vaccinator',
    issuerBasis:
      'EpG/LEp and the cantonal authorisation to vaccinate — a practice, a pharmacy with a ' +
      'vaccination permit, or a company medical service. The issuing DID must carry a Governed ' +
      'Use Case Authorization Trust Marker naming this credential type, because "who is allowed ' +
      'to say that a vaccination happened" is precisely what a verifier needs to check.',
    governed: true,
    revocation:
      'Only the issuer may revoke, and only to correct a recording error — never to withdraw a ' +
      'vaccination that took place. Revoking a dose credential does not undo the dose; it ' +
      'withdraws an assertion the issuer should not have made.',
    retention:
      'A verifier checking vaccination status retains the outcome its own record requires and ' +
      'discards the credential. A travel clinic needs to know the series is complete, and keeps ' +
      'that conclusion alone.',
    verifierRoles: [
      {
        role: 'ch.didas.health.role.practice',
        purpose: 'Establish vaccination status before advising or vaccinating',
        claims: [
          'immunization_id',
          'patient_given_name',
          'patient_family_name',
          'patient_birth_date',
          'vaccine_code',
          'vaccine_name',
          'target_disease',
          'occurrence_date',
          'dose_number',
          'doses_in_series',
          'next_dose_due',
          'lot_number',
          'route',
          'site',
          'performer_name',
          'performer_gln',
          'organization_name',
          'country',
        ],
      },
      {
        role: 'ch.didas.health.role.pharmacy',
        purpose: 'Check the series before administering the next dose',
        claims: [
          'vaccine_code',
          'vaccine_name',
          'target_disease',
          'occurrence_date',
          'dose_number',
          'doses_in_series',
          'next_dose_due',
        ],
      },
      {
        // The case selective disclosure exists for. A travel clinic needs to
        // know which disease you are protected against and when — not the lot
        // number. Who vaccinated you and where stay in the wallet.
        role: 'ch.didas.health.role.travel-clinic',
        purpose: 'Confirm protection against a specific disease for travel advice',
        claims: ['target_disease', 'occurrence_date', 'dose_number', 'doses_in_series'],
      },
      {
        role: 'ch.didas.health.role.research',
        purpose: 'Secondary use under explicit, revocable patient consent',
        claims: ['vaccine_code', 'target_disease', 'occurrence_date', 'dose_number'],
      },
      {
        /**
         * A national coverage survey. It samples households from the
         * population register, so it already knows the age and the canton of
         * the person it invited — which is why this entitlement carries no
         * identifying claim and no demographic one. What it cannot get from
         * its own frame is the clinical fact, and that is all it asks for.
         */
        role: 'ch.didas.health.role.statistics',
        purpose: 'National vaccination coverage monitoring',
        claims: ['target_disease', 'occurrence_date', 'dose_number', 'doses_in_series', 'vaccine_code'],
      },
    ],
  },
  claims: [
    {
      name: 'immunization_id',
      type: 'Text',
      required: true,
      semantics: { fhir: { path: 'Immunization.identifier.value' } },
      label: {
        'de-CH': 'Eintragsnummer',
        'fr-CH': "Numéro d'enregistrement",
        'it-CH': 'Numero di registrazione',
        'en-GB': 'Record number',
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
      /** SNOMED CT vaccine product code, as CH VACD and the IPS both require. */
      name: 'vaccine_code',
      type: 'Text',
      required: true,
      semantics: {
        openehr: {
          archetypeId: 'openEHR-EHR-CLUSTER.medication.v2',
          element: 'Name',
          path: 'immunisation/medication_management/medication_item/medication_details/name',
        },
        fhir: { path: 'Immunization.vaccineCode.coding.code' },
        terminology: { system: 'http://snomed.info/sct', code: 'SNOMED CT', display: 'Vaccine product' },
      },
      label: { 'de-CH': 'Impfstoffcode', 'fr-CH': 'Code du vaccin', 'it-CH': 'Codice del vaccino', 'en-GB': 'Vaccine code' },
      // Demo data throughout this project uses illustrative SNOMED codes. A
      // deployment must take the real product concept from SNOMED CT — a
      // plausible-looking wrong code in a vaccination record is worse than an
      // obviously missing one.
      schema: { type: 'string', pattern: '^[0-9]{6,18}$' },
    },
    {
      name: 'vaccine_name',
      type: 'Text',
      required: true,
      semantics: {
        openehr: {
          archetypeId: 'openEHR-EHR-ACTION.medication.v1',
          element: 'Medication item',
          path: 'immunisation/medication_management/medication_item',
        },
        fhir: { path: 'Immunization.vaccineCode.text' },
      },
      label: { 'de-CH': 'Impfstoff', 'fr-CH': 'Vaccin', 'it-CH': 'Vaccino', 'en-GB': 'Vaccine' },
      schema: { type: 'string', minLength: 1, maxLength: 300 },
    },
    {
      /**
       * The diseases this dose protects against, SNOMED-coded. Separate from
       * the product code on purpose: a verifier almost always cares about the
       * disease, so asking for this claim alone is the
       * minimising question.
       */
      name: 'target_disease',
      type: 'Array[Text]',
      required: true,
      semantics: {
        fhir: { path: 'Immunization.protocolApplied.targetDisease.coding.code' },
        terminology: { system: 'http://snomed.info/sct', code: 'SNOMED CT', display: 'Target disease' },
      },
      label: {
        'de-CH': 'Schützt gegen',
        'fr-CH': 'Protège contre',
        'it-CH': 'Protegge da',
        'en-GB': 'Protects against',
      },
      schema: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1, maxLength: 200 } },
    },
    {
      name: 'occurrence_date',
      type: 'DateTime',
      required: true,
      format: 'YYYY-MM-DD',
      semantics: {
        openehr: {
          archetypeId: 'openEHR-EHR-ACTION.medication.v1',
          element: 'Medication management',
          path: 'immunisation/medication_management/time',
        },
        fhir: { path: 'Immunization.occurrenceDateTime' },
      },
      label: { 'de-CH': 'Impfdatum', 'fr-CH': 'Date de vaccination', 'it-CH': 'Data di vaccinazione', 'en-GB': 'Date given' },
      schema: { type: 'string', format: 'date' },
    },
    {
      name: 'dose_number',
      type: 'Numeric',
      required: true,
      semantics: { fhir: { path: 'Immunization.protocolApplied.doseNumberPositiveInt' } },
      label: { 'de-CH': 'Dosis Nr.', 'fr-CH': 'Dose n°', 'it-CH': 'Dose n.', 'en-GB': 'Dose number' },
      schema: { type: 'integer', minimum: 1, maximum: 20 },
    },
    {
      name: 'doses_in_series',
      type: 'Numeric',
      required: true,
      semantics: { fhir: { path: 'Immunization.protocolApplied.seriesDosesPositiveInt' } },
      label: {
        'de-CH': 'Dosen in der Serie',
        'fr-CH': 'Doses dans la série',
        'it-CH': 'Dosi nella serie',
        'en-GB': 'Doses in series',
      },
      schema: { type: 'integer', minimum: 1, maximum: 20 },
    },
    {
      name: 'next_dose_due',
      type: 'DateTime',
      required: false,
      format: 'YYYY-MM-DD',
      semantics: { fhir: { path: 'Immunization.protocolApplied.series' } },
      label: {
        'de-CH': 'Nächste Dosis fällig',
        'fr-CH': 'Prochaine dose',
        'it-CH': 'Prossima dose',
        'en-GB': 'Next dose due',
      },
      schema: { type: 'string', format: 'date' },
    },
    {
      name: 'lot_number',
      type: 'Text',
      required: true,
      semantics: {
        openehr: {
          archetypeId: 'openEHR-EHR-CLUSTER.medication.v2',
          element: 'Batch ID',
          path: 'immunisation/medication_management/medication_item/medication_details/batch_id',
        },
        fhir: { path: 'Immunization.lotNumber' },
      },
      label: { 'de-CH': 'Chargennummer', 'fr-CH': 'Numéro de lot', 'it-CH': 'Numero di lotto', 'en-GB': 'Lot number' },
      schema: { type: 'string', minLength: 1, maxLength: 64 },
    },
    {
      name: 'route',
      type: 'Text',
      required: true,
      semantics: {
        openehr: {
          archetypeId: 'openEHR-EHR-ACTION.medication.v1',
          element: 'Route',
          path: 'immunisation/medication_management/route',
        },
        fhir: { path: 'Immunization.route.coding.code' },
      },
      label: { 'de-CH': 'Applikationsart', 'fr-CH': "Voie d'administration", 'it-CH': 'Via di somministrazione', 'en-GB': 'Route' },
      schema: { type: 'string', enum: ['IM', 'SC', 'ID', 'PO', 'NASINHL'] },
    },
    {
      name: 'site',
      type: 'Text',
      required: false,
      semantics: { fhir: { path: 'Immunization.site.text' } },
      label: { 'de-CH': 'Injektionsstelle', 'fr-CH': "Site d'injection", 'it-CH': 'Sede di iniezione', 'en-GB': 'Site' },
      schema: { type: 'string', maxLength: 100 },
    },
    {
      name: 'performer_name',
      type: 'Text',
      required: true,
      semantics: { fhir: { path: 'Immunization.performer.actor.display' } },
      label: {
        'de-CH': 'Impfende Person',
        'fr-CH': 'Vaccinateur',
        'it-CH': 'Vaccinatore',
        'en-GB': 'Administered by',
      },
      schema: { type: 'string', minLength: 1, maxLength: 200 },
    },
    {
      name: 'performer_gln',
      type: 'Text',
      required: true,
      semantics: {
        fhir: { path: 'Immunization.performer.actor.identifier.value' },
        terminology: { system: 'urn:oid:2.51.1.3', code: 'GLN', display: 'GS1 Global Location Number' },
      },
      label: { 'de-CH': 'GLN', 'fr-CH': 'GLN', 'it-CH': 'GLN', 'en-GB': 'GLN' },
      schema: { type: 'string', pattern: '^[0-9]{13}$' },
    },
    {
      name: 'organization_name',
      type: 'Text',
      required: true,
      semantics: { fhir: { path: 'Immunization.location.display' } },
      label: { 'de-CH': 'Impfstelle', 'fr-CH': 'Lieu de vaccination', 'it-CH': 'Luogo di vaccinazione', 'en-GB': 'Location' },
      schema: { type: 'string', minLength: 1, maxLength: 200 },
    },
    {
      name: 'country',
      type: 'Text',
      required: true,
      semantics: { terminology: { system: 'urn:iso:std:iso:3166', code: 'ISO 3166-1 alpha-2' } },
      label: { 'de-CH': 'Land', 'fr-CH': 'Pays', 'it-CH': 'Paese', 'en-GB': 'Country' },
      schema: { type: 'string', pattern: '^[A-Z]{2}$' },
    },
  ],
};
