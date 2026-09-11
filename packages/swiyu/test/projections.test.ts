import { describe, expect, it } from 'vitest';

import {
  IMMUNIZATION,
  INSURANCE_CARD,
  LAB_REPORT,
  PRESCRIPTION,
  projectToFhir,
  projectToOpenEhr,
} from '../src/index.js';

describe('FHIR projection', () => {
  it('turns an insurance card into a Coverage', () => {
    const { resource } = projectToFhir(INSURANCE_CARD, {
      given_name: 'DIDAS',
      family_name: 'Patient',
      birth_date: '1988-09-12',
      card_number: '80756000000000000001',
      personal_administrative_number: '756.1234.5678.97',
      insurer_name: 'DIDAS',
      insurer_ber_number: '01509',
      coverage: ['KVG', 'VVG'],
      valid_from: '2026-01-01',
      expiry_date: '2026-12-31',
    });
    expect(resource.resourceType).toBe('Coverage');
    expect((resource.beneficiary as { display: string }).display).toBe('DIDAS Patient');
    // `coverage` is an array of codes, so each becomes its own coding.
    expect((resource.type as { coding: { code: string }[] }).coding.map((c) => c.code)).toEqual(['KVG', 'VVG']);
    expect((resource.period as { start: string; end: string })).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    });
  });

  it('only projects what the holder actually released', () => {
    // A partial disclosure is legitimate and projects cleanly.
    const { resource } = projectToFhir(INSURANCE_CARD, { insurer_name: 'DIDAS', coverage: ['KVG'] });
    expect(resource.beneficiary).toBeUndefined();
    expect((resource.payor as { display: string }[])[0]?.display).toBe('DIDAS');
  });

  it('turns a prescription into a MedicationRequest', () => {
    const { resource } = projectToFhir(PRESCRIPTION, {
      prescription_id: 'RX-1',
      patient_given_name: 'DIDAS',
      patient_family_name: 'Patient',
      medication: [
        { name: 'Atorvastatin 20 mg', gtin: '7680620930015', dosage: '1 in the evening', quantity: 100, substitution_allowed: true },
      ],
      prescriber_name: 'Dr. Muster',
      prescriber_gln: '7601000000001',
      issued_date: '2026-09-11',
      expiry_date: '2027-09-11',
      repeats_authorized: 2,
    });
    expect(resource.resourceType).toBe('MedicationRequest');
    expect((resource.medicationCodeableConcept as { text: string }).text).toBe('Atorvastatin 20 mg');
    expect((resource.dosageInstruction as { text: string }[])[0]?.text).toBe('1 in the evening');
    expect((resource.substitution as { allowedBoolean: boolean }).allowedBoolean).toBe(true);
    expect((resource.dispenseRequest as { numberOfRepeatsAllowed: number }).numberOfRepeatsAllowed).toBe(2);
  });

  it('bundles a multi-item prescription', () => {
    const { resource } = projectToFhir(PRESCRIPTION, {
      prescription_id: 'RX-2',
      medication: [
        { name: 'A', dosage: '1', quantity: 1, substitution_allowed: false },
        { name: 'B', dosage: '2', quantity: 2, substitution_allowed: true },
      ],
    });
    expect(resource.resourceType).toBe('Bundle');
    expect((resource.entry as unknown[]).length).toBe(2);
  });

  it('turns lab findings into a DiagnosticReport with one Observation each', () => {
    const { resource } = projectToFhir(LAB_REPORT, {
      report_id: 'LAB-1',
      patient_given_name: 'DIDAS',
      patient_family_name: 'Patient',
      findings: [
        { loinc_code: '2093-3', analyte: 'Cholesterol', value: '6.4', unit: 'mmol/L', reference_range: '< 5.0', flag: 'HIGH' },
        { loinc_code: '718-7', analyte: 'Haemoglobin', value: '132', unit: 'g/L', reference_range: '120-160', flag: 'NORMAL' },
      ],
      report_date: '2026-09-11',
      specimen_date: '2026-09-10',
      laboratory_name: 'DIDAS Praxislabor',
      ordering_physician_gln: '7601000000001',
    });
    const entries = resource.entry as { resource: Record<string, unknown> }[];
    expect(entries[0]?.resource.resourceType).toBe('DiagnosticReport');
    expect(entries.filter((entry) => entry.resource.resourceType === 'Observation')).toHaveLength(2);
    const observation = entries[1]?.resource as { code: { coding: { system: string; code: string }[] }; valueQuantity: { value: string; unit: string } };
    expect(observation.code.coding[0]).toMatchObject({ system: 'http://loinc.org', code: '2093-3' });
    expect(observation.valueQuantity).toEqual({ value: '6.4', unit: 'mmol/L' });
  });
});

describe('the immunization showcase projects into CH VACD and IPS shapes', () => {
  const dose = {
    immunization_id: 'IMM-1',
    patient_given_name: 'DIDAS',
    patient_family_name: 'Patient',
    patient_birth_date: '1988-09-12',
    vaccine_code: '871895005',
    vaccine_name: 'dTpa-IPV combination vaccine',
    target_disease: ['Tetanus', 'Pertussis'],
    occurrence_date: '2026-09-11',
    dose_number: 1,
    doses_in_series: 3,
    lot_number: 'S4021-B',
    route: 'IM',
    performer_name: 'Dr. Muster',
    performer_gln: '7601000000001',
    organization_name: 'DIDAS Hausarztpraxis',
    country: 'CH',
  };

  it('assembles dose, series and disease into one protocolApplied entry', () => {
    const { resource } = projectToFhir(IMMUNIZATION, dose);
    expect(resource.resourceType).toBe('Immunization');
    expect(resource.status).toBe('completed');
    const protocol = (resource.protocolApplied as Record<string, unknown>[])[0];
    expect(protocol).toMatchObject({ doseNumberPositiveInt: 1, seriesDosesPositiveInt: 3 });
    expect((protocol?.targetDisease as { text: string }[]).map((d) => d.text)).toEqual([
      'Tetanus',
      'Pertussis',
    ]);
    // The bare `targetDisease` the generic setter would leave behind is removed.
    expect(resource).not.toHaveProperty('targetDisease');
    expect((resource.vaccineCode as { coding: { system: string }[] }).coding[0]?.system).toBe(
      'http://snomed.info/sct',
    );
  });

  it('carries the CH VACD profile claim', () => {
    const { resource } = projectToFhir(IMMUNIZATION, dose);
    expect((resource.meta as { profile: string[] }).profile[0]).toContain('ch-vacd');
  });

  it('projects a travel clinic\'s four disclosed claims without inventing the rest', () => {
    // Exactly what F-03 releases: disease, date, and the series position.
    const { resource } = projectToFhir(IMMUNIZATION, {
      target_disease: ['Tetanus'],
      occurrence_date: '2026-09-11',
      dose_number: 1,
      doses_in_series: 3,
    });
    expect(resource.occurrenceDateTime).toBe('2026-09-11');
    expect(resource.lotNumber).toBeUndefined();
    expect(resource.performer).toBeUndefined();
    expect(resource.vaccineCode).toBeUndefined();
    // A patient element with a placeholder display is the one thing the shape
    // forces; it must not claim a name that was never disclosed.
    expect((resource.patient as { display: string }).display).toBe('unknown');
  });

  it('builds an openEHR composition from the same dose', () => {
    const { composition, templateId } = projectToOpenEhr(IMMUNIZATION, dose);
    expect(templateId).toBe('DIDAS.immunisation.v0');
    expect(composition['immunisation/medication_management/medication_item']).toBe(dose.vaccine_name);
    expect(composition['immunisation/medication_management/medication_item/medication_details/batch_id']).toBe('S4021-B');
    expect(composition['immunisation/territory|code']).toBe('CH');
  });
});

describe('openEHR projection', () => {
  it('builds a flat composition with indexed repeating nodes', () => {
    const { composition, templateId, archetypeId } = projectToOpenEhr(LAB_REPORT, {
      findings: [
        { loinc_code: '2093-3', analyte: 'Cholesterol', value: '6.4', unit: 'mmol/L', reference_range: '< 5.0', flag: 'HIGH' },
        { loinc_code: '718-7', analyte: 'Haemoglobin', value: '132', unit: 'g/L', reference_range: '120-160', flag: 'NORMAL' },
      ],
      interpretation: 'Elevated LDL.',
      specimen_date: '2026-09-10',
    });
    expect(templateId).toBe('DIDAS.laboratory_report.v0');
    expect(archetypeId).toBe('openEHR-EHR-OBSERVATION.laboratory_test_result.v1');
    expect(composition['laboratory_report/laboratory_test_result/any_event/laboratory_analyte_result:0/analyte_result']).toBe('6.4');
    expect(composition['laboratory_report/laboratory_test_result/any_event/laboratory_analyte_result:1/analyte_result']).toBe('132');
    expect(composition['laboratory_report/laboratory_test_result/any_event/conclusion']).toBe('Elevated LDL.');
    // Context every composition needs to be well formed.
    expect(composition['laboratory_report/territory|code']).toBe('CH');
  });

  it('reports claims that have no openEHR binding instead of dropping them silently', () => {
    const { unmapped } = projectToOpenEhr(PRESCRIPTION, {
      prescription_id: 'RX-1',
      medication: [{ name: 'A', dosage: '1', quantity: 1, substitution_allowed: true }],
    });
    expect(unmapped).toContain('prescription_id');
    expect(unmapped).toContain('medication[0].substitution_allowed');
  });

  it('refuses a credential type that has no openEHR model', () => {
    expect(() => projectToOpenEhr(INSURANCE_CARD, {})).toThrow(/no openEHR template/);
  });
});
