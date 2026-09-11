/**
 * Laboratory findings from a consultation, issued to the patient's wallet.
 *
 * This is the "examination results" half of the hackathon scenario: after the
 * consultation the practice hands the patient their own results as a credential
 * they hold, rather than a PDF in a portal the practice controls. Analytes are
 * identified by LOINC so a downstream system can read them.
 */

import type { CredentialDefinition } from '../credential-definition.js';

export const LAB_REPORT: CredentialDefinition = {
  configurationId: 'health_lab_report_sd_jwt',
  vct: 'urn:vct:ch.didas.health.lab-report:1.0',
  name: 'Laboratory Report',
  displayName: {
    'de-CH': 'Laborbefund',
    'fr-CH': 'Rapport de laboratoire',
    'it-CH': 'Referto di laboratorio',
    'en-GB': 'Laboratory Report',
  },
  description: {
    'de-CH': 'Laborbefund einer ärztlichen Konsultation.',
    'fr-CH': "Rapport de laboratoire d'une consultation médicale.",
    'it-CH': 'Referto di laboratorio di una consultazione medica.',
    'en-GB': 'Laboratory findings from a medical consultation.',
  },
  backgroundColor: '#5B3E8E',
  textColor: '#FFFFFF',
  primaryField: '{{report_date}}',
  secondaryField: '{{laboratory_name}}',
  refreshable: false,
  order: [
    'findings',
    'interpretation',
    'report_date',
    'specimen_date',
    'patient_given_name',
    'patient_family_name',
    'patient_birth_date',
    'laboratory_name',
    'ordering_physician_gln',
    'report_id',
  ],
  // The laboratory result archetype is one of openEHR's most widely deployed
  // models, and FHIR's Observation/DiagnosticReport pair is what every lab
  // interface already speaks. Both are reused here as *models*: the credential
  // carries the archetype and element paths, so a receiving system can rebuild
  // either representation locally. What is not reused is the assumption that
  // the record lives in a repository the patient cannot reach.
  semantics: {
    openehr: {
      templateId: 'DIDAS.laboratory_report.v0',
      archetypeId: 'openEHR-EHR-OBSERVATION.laboratory_test_result.v1',
    },
    fhir: {
      resourceType: 'DiagnosticReport',
      profile: 'http://hl7.org/fhir/StructureDefinition/DiagnosticReport',
    },
  },
  governance: {
    issuerRole: 'ch.didas.health.role.laboratory',
    issuerBasis:
      'A laboratory authorised under the KVG analysis list, or the treating practice ' +
      'issuing on its behalf; either way the issuing DID must carry the authorization ' +
      'marker for this credential type',
    governed: true,
    revocation:
      'The issuing laboratory revokes on a corrected or withdrawn result. The patient keeps ' +
      'the superseded credential in the wallet but it no longer verifies, which is the ' +
      'behaviour a corrected finding needs.',
    retention:
      'A verifying practice may retain the findings in the treatment record; a research ' +
      'recipient may retain only what the consent covers, and never the identifying claims.',
    verifierRoles: [
      {
        role: 'ch.didas.health.role.practice',
        purpose: 'Read the findings during a consultation',
        claims: [
          'report_id',
          'patient_given_name',
          'patient_family_name',
          'patient_birth_date',
          'findings',
          'interpretation',
          'specimen_date',
          'report_date',
          'laboratory_name',
          'ordering_physician_gln',
        ],
      },
      {
        // Secondary use is where selective disclosure earns its keep: the
        // research entitlement simply cannot include the identifying claims,
        // so a request for them is refused before it is ever sent.
        role: 'ch.didas.health.role.research',
        purpose: 'Secondary use under explicit, revocable patient consent',
        claims: ['findings', 'specimen_date', 'report_date'],
      },
    ],
  },
  claims: [
    {
      name: 'report_id',
      type: 'Text',
      required: true,
      label: {
        'de-CH': 'Befundnummer',
        'fr-CH': 'Numéro du rapport',
        'it-CH': 'Numero del referto',
        'en-GB': 'Report number',
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
      name: 'findings',
      type: 'Array[Reference]',
      required: true,
      label: { 'de-CH': 'Befunde', 'fr-CH': 'Résultats', 'it-CH': 'Risultati', 'en-GB': 'Findings' },
      schema: {},
      nested: [
        {
          name: 'loinc_code',
          type: 'Text',
          required: true,
          semantics: {
            openehr: {
              archetypeId: 'openEHR-EHR-OBSERVATION.laboratory_test_result.v1',
              element: 'Test name',
              path: 'laboratory_report/laboratory_test_result/any_event/test_name',
            },
            fhir: { path: 'Observation.code.coding.code' },
            terminology: { system: 'http://loinc.org', code: 'LOINC' },
          },
          label: { 'de-CH': 'LOINC', 'fr-CH': 'LOINC', 'it-CH': 'LOINC', 'en-GB': 'LOINC' },
          schema: { type: 'string', pattern: '^[0-9]{1,5}-[0-9]$' },
        },
        {
          name: 'analyte',
          type: 'Text',
          required: true,
          semantics: {
            openehr: {
              archetypeId: 'openEHR-EHR-CLUSTER.laboratory_test_analyte.v1',
              element: 'Analyte name',
              path: 'laboratory_report/laboratory_test_result/any_event/laboratory_analyte_result/analyte_name',
            },
            fhir: { path: 'Observation.code.text' },
          },
          label: { 'de-CH': 'Analyt', 'fr-CH': 'Analyte', 'it-CH': 'Analita', 'en-GB': 'Analyte' },
          schema: { type: 'string', minLength: 1, maxLength: 200 },
        },
        {
          name: 'value',
          type: 'Text',
          required: true,
          semantics: {
            openehr: {
              archetypeId: 'openEHR-EHR-CLUSTER.laboratory_test_analyte.v1',
              element: 'Analyte result',
              path: 'laboratory_report/laboratory_test_result/any_event/laboratory_analyte_result/analyte_result',
            },
            fhir: { path: 'Observation.valueQuantity.value' },
          },
          label: { 'de-CH': 'Wert', 'fr-CH': 'Valeur', 'it-CH': 'Valore', 'en-GB': 'Value' },
          schema: { type: 'string', minLength: 1, maxLength: 100 },
        },
        {
          name: 'unit',
          type: 'Text',
          required: true,
          semantics: {
            fhir: { path: 'Observation.valueQuantity.unit' },
            terminology: { system: 'http://unitsofmeasure.org', code: 'UCUM' },
          },
          label: { 'de-CH': 'Einheit', 'fr-CH': 'Unité', 'it-CH': 'Unità', 'en-GB': 'Unit' },
          schema: { type: 'string', maxLength: 50 },
        },
        {
          name: 'reference_range',
          type: 'Text',
          required: true,
          semantics: {
            openehr: {
              archetypeId: 'openEHR-EHR-CLUSTER.laboratory_test_analyte.v1',
              element: 'Reference range guidance',
              path: 'laboratory_report/laboratory_test_result/any_event/laboratory_analyte_result/reference_range_guidance',
            },
            fhir: { path: 'Observation.referenceRange.text' },
          },
          label: {
            'de-CH': 'Referenzbereich',
            'fr-CH': 'Valeurs de référence',
            'it-CH': 'Valori di riferimento',
            'en-GB': 'Reference range',
          },
          schema: { type: 'string', maxLength: 100 },
        },
        {
          name: 'flag',
          type: 'Text',
          required: true,
          semantics: {
            fhir: { path: 'Observation.interpretation.coding.code' },
            terminology: {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
              code: 'ObservationInterpretation',
            },
          },
          label: {
            'de-CH': 'Bewertung',
            'fr-CH': 'Évaluation',
            'it-CH': 'Valutazione',
            'en-GB': 'Interpretation',
          },
          schema: { type: 'string', enum: ['NORMAL', 'LOW', 'HIGH', 'CRITICAL'] },
        },
      ],
    },
    {
      name: 'interpretation',
      type: 'Text',
      required: false,
      semantics: {
        openehr: {
          archetypeId: 'openEHR-EHR-OBSERVATION.laboratory_test_result.v1',
          element: 'Conclusion',
          path: 'laboratory_report/laboratory_test_result/any_event/conclusion',
        },
        fhir: { path: 'DiagnosticReport.conclusion' },
      },
      sensitive: true,
      label: {
        'de-CH': 'Beurteilung',
        'fr-CH': 'Appréciation',
        'it-CH': 'Valutazione',
        'en-GB': 'Assessment',
      },
      schema: { type: 'string', maxLength: 2000 },
    },
    {
      name: 'specimen_date',
      type: 'DateTime',
      required: true,
      semantics: {
        openehr: {
          archetypeId: 'openEHR-EHR-CLUSTER.specimen.v1',
          element: 'Collection date/time',
          path: 'laboratory_report/laboratory_test_result/any_event/specimen/collection_date_time',
        },
        fhir: { path: 'Specimen.collection.collectedDateTime' },
      },
      format: 'YYYY-MM-DD',
      label: {
        'de-CH': 'Entnahmedatum',
        'fr-CH': 'Date du prélèvement',
        'it-CH': 'Data del prelievo',
        'en-GB': 'Specimen date',
      },
      schema: { type: 'string', format: 'date' },
    },
    {
      name: 'report_date',
      type: 'DateTime',
      required: true,
      semantics: { fhir: { path: 'DiagnosticReport.issued' } },
      format: 'YYYY-MM-DD',
      label: {
        'de-CH': 'Befunddatum',
        'fr-CH': 'Date du rapport',
        'it-CH': 'Data del referto',
        'en-GB': 'Report date',
      },
      schema: { type: 'string', format: 'date' },
    },
    {
      name: 'laboratory_name',
      type: 'Text',
      required: true,
      label: { 'de-CH': 'Labor', 'fr-CH': 'Laboratoire', 'it-CH': 'Laboratorio', 'en-GB': 'Laboratory' },
      schema: { type: 'string', minLength: 1, maxLength: 200 },
    },
    {
      name: 'ordering_physician_gln',
      type: 'Text',
      required: true,
      label: {
        'de-CH': 'GLN Auftraggeber',
        'fr-CH': 'GLN du prescripteur',
        'it-CH': 'GLN del richiedente',
        'en-GB': 'Ordering physician GLN',
      },
      schema: { type: 'string', pattern: '^[0-9]{13}$' },
    },
  ],
};
