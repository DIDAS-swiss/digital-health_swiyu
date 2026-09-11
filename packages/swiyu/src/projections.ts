/**
 * Projecting a presented credential back into the clinical models.
 *
 * This is the architectural claim of the project, made concrete. openEHR and
 * HL7 FHIR give the health sector shared *information models*; their usual
 * deployment shape also gives it a shared *repository* — a CDR or a FHIR server
 * that someone operates and that the patient does not control. Here the models
 * are reused and the repository is not: the credential in the patient's wallet
 * is the record, and a receiving system reconstructs the representation it
 * already understands at the moment the data is presented to it.
 *
 * Two consequences follow:
 *
 *   1. A projection is derived, never authoritative. The signed SD-JWT VC is
 *      the evidence; the FHIR resource built from it is a local convenience and
 *      carries no signature of its own. Anything that needs to prove provenance
 *      must keep the presentation itself.
 *   2. A projection only ever contains the claims the holder actually released.
 *      Selective disclosure means a resource built this way is legitimately
 *      partial, and receiving systems have to tolerate that, without
 *      treating a missing element as an error.
 *
 * The mappings cover the claims of this project's three credential types. This
 * is a working projection for those models.
 */

import type { ClaimDefinition, CredentialDefinition } from './credential-definition.js';

/* ------------------------------------------------------------------ FHIR */

/** FHIR elements that are arrays, so a path through them appends a new entry. */
const FHIR_ARRAY_ELEMENTS = new Set([
  'coding',
  'payor',
  'identifier',
  'interpretation',
  'referenceRange',
  'dosageInstruction',
  'category',
  'performer',
  'result',
  'entry',
  'type',
]);

/**
 * `type` is an array on some resources and a single element on others. FHIR
 * cardinality is per-resource-element, so the exceptions are listed here by
 * resource and element name.
 */
const FHIR_SINGLE_ELEMENT_OVERRIDES = new Set(['Coverage.type', 'Coverage.identifier']);

function setFhirPath(
  resource: Record<string, unknown>,
  resourceType: string,
  path: string[],
  value: unknown,
  options: { appendRepetition?: boolean } = {},
): void {
  let cursor: Record<string, unknown> = resource;
  let prefix = resourceType;
  // A repeated claim value (e.g. each code in `coverage`) must land in its own
  // element of the first repeating ancestor, leaving the previous one intact.
  let pendingRepetition = options.appendRepetition ?? false;

  for (let index = 0; index < path.length; index += 1) {
    const segment = path[index];
    if (segment === undefined) return;
    prefix = `${prefix}.${segment}`;
    const isLast = index === path.length - 1;
    const isArray = FHIR_ARRAY_ELEMENTS.has(segment) && !FHIR_SINGLE_ELEMENT_OVERRIDES.has(prefix);

    if (isLast) {
      if (isArray) {
        const existing = Array.isArray(cursor[segment]) ? (cursor[segment] as unknown[]) : [];
        cursor[segment] = [...existing, value];
      } else {
        cursor[segment] = value;
      }
      return;
    }

    if (isArray) {
      const existing = Array.isArray(cursor[segment]) ? (cursor[segment] as unknown[]) : [];
      if (existing.length === 0 || pendingRepetition) {
        existing.push({});
        pendingRepetition = false;
      }
      cursor[segment] = existing;
      cursor = existing[existing.length - 1] as Record<string, unknown>;
    } else {
      if (typeof cursor[segment] !== 'object' || cursor[segment] === null) cursor[segment] = {};
      cursor = cursor[segment] as Record<string, unknown>;
    }
  }
}

function applyClaims(
  resource: Record<string, unknown>,
  resourceType: string,
  claims: ClaimDefinition[],
  values: Record<string, unknown>,
): void {
  for (const claim of claims) {
    const value = values[claim.name];
    if (value === undefined || value === null) continue; // not disclosed
    const fhirPath = claim.semantics?.fhir?.path;
    if (!fhirPath) continue;
    const [head, ...rest] = fhirPath.split('.');
    // A path may name a different resource (e.g. `Specimen.collection...` on a
    // DiagnosticReport); those are handled by the resource-specific builders.
    if (head !== resourceType || rest.length === 0) continue;
    if (Array.isArray(value) && claim.type === 'Array[Text]') {
      for (const element of value) {
        setFhirPath(resource, resourceType, rest, element, { appendRepetition: true });
      }
    } else {
      setFhirPath(resource, resourceType, rest, value);
    }
  }
}

export interface FhirProjection {
  /** A single resource, or a `collection` Bundle when the credential yields several. */
  resource: Record<string, unknown>;
  /** Claims that were disclosed but had no FHIR binding, so nothing was lost silently. */
  unmapped: string[];
}

/**
 * Build FHIR resources from the claims a wallet disclosed.
 * `values` is the `credential_subject_data` entry for one DCQL query id.
 */
export function projectToFhir(
  definition: CredentialDefinition,
  values: Record<string, unknown>,
): FhirProjection {
  const resourceType = definition.semantics?.fhir?.resourceType;
  if (!resourceType) {
    throw new Error(`${definition.vct} declares no FHIR resource type`);
  }
  const profile = definition.semantics?.fhir?.profile;
  const meta = profile ? { meta: { profile: [profile] } } : {};

  switch (resourceType) {
    case 'Coverage': {
      const resource: Record<string, unknown> = { resourceType, ...meta, status: 'active' };
      applyClaims(resource, 'Coverage', definition.claims, values);
      nameIntoBeneficiary(resource, values, 'given_name', 'family_name', 'birth_date');
      if (values.expiry_date) {
        setFhirPath(resource, 'Coverage', ['period', 'end'], values.expiry_date);
      }
      return { resource, unmapped: unmappedClaims(definition, values, ['expiry_date']) };
    }

    case 'MedicationRequest': {
      const medication = Array.isArray(values.medication) ? values.medication : [];
      const medicationClaim = definition.claims.find((claim) => claim.name === 'medication');
      const requests = medication.map((entry, index) => {
        const request: Record<string, unknown> = {
          resourceType: 'MedicationRequest',
          ...meta,
          id: `${String(values.prescription_id ?? 'rx')}-${index + 1}`,
          status: 'active',
          intent: 'order',
          subject: { display: patientDisplay(values, 'patient_given_name', 'patient_family_name') },
        };
        applyClaims(
          request,
          'MedicationRequest',
          medicationClaim?.nested ?? [],
          entry as Record<string, unknown>,
        );
        applyClaims(request, 'MedicationRequest', definition.claims, values);
        if (values.prescriber_name) {
          setFhirPath(request, 'MedicationRequest', ['requester', 'display'], values.prescriber_name);
        }
        if (values.expiry_date) {
          setFhirPath(request, 'MedicationRequest', ['dispenseRequest', 'validityPeriod', 'end'], values.expiry_date);
        }
        if (values.repeats_authorized !== undefined) {
          setFhirPath(
            request,
            'MedicationRequest',
            ['dispenseRequest', 'numberOfRepeatsAllowed'],
            values.repeats_authorized,
          );
        }
        return request;
      });
      return {
        resource:
          requests.length === 1 && requests[0]
            ? requests[0]
            : { resourceType: 'Bundle', type: 'collection', entry: requests.map((r) => ({ resource: r })) },
        unmapped: unmappedClaims(definition, values, ['medication', 'prescriber_name', 'expiry_date', 'repeats_authorized']),
      };
    }

    case 'DiagnosticReport': {
      const findings = Array.isArray(values.findings) ? values.findings : [];
      const findingsClaim = definition.claims.find((claim) => claim.name === 'findings');
      const observations = findings.map((entry, index) => {
        const observation: Record<string, unknown> = {
          resourceType: 'Observation',
          id: `${String(values.report_id ?? 'obs')}-${index + 1}`,
          status: 'final',
          subject: { display: patientDisplay(values, 'patient_given_name', 'patient_family_name') },
        };
        applyClaims(observation, 'Observation', findingsClaim?.nested ?? [], entry as Record<string, unknown>);
        // The LOINC code needs its system alongside the code to be usable.
        const code = observation.code as { coding?: { system?: string }[] } | undefined;
        if (code?.coding?.[0]) code.coding[0].system = 'http://loinc.org';
        if (values.specimen_date) observation.effectiveDateTime = values.specimen_date;
        return observation;
      });

      const report: Record<string, unknown> = {
        resourceType: 'DiagnosticReport',
        ...meta,
        id: String(values.report_id ?? 'report'),
        status: 'final',
        subject: { display: patientDisplay(values, 'patient_given_name', 'patient_family_name') },
        result: observations.map((observation) => ({ reference: `Observation/${String(observation.id)}` })),
      };
      applyClaims(report, 'DiagnosticReport', definition.claims, values);
      if (values.laboratory_name) report.performer = [{ display: values.laboratory_name }];
      if (values.specimen_date) report.effectiveDateTime = values.specimen_date;

      return {
        resource: {
          resourceType: 'Bundle',
          type: 'collection',
          entry: [report, ...observations].map((resource) => ({ resource })),
        },
        unmapped: unmappedClaims(definition, values, ['findings', 'laboratory_name', 'specimen_date']),
      };
    }

    case 'Immunization': {
      const resource: Record<string, unknown> = {
        resourceType,
        ...meta,
        // IPS and CH VACD both require a status; a credential only ever
        // attests a dose that was given, so it is always `completed`.
        status: 'completed',
        patient: { display: patientDisplay(values, 'patient_given_name', 'patient_family_name') },
      };
      applyClaims(resource, 'Immunization', definition.claims, values);

      // `protocolApplied` is a backbone element carrying dose, series and
      // target disease together; the generic setter would otherwise scatter
      // them, so it is assembled explicitly.
      const protocol: Record<string, unknown> = {};
      if (Array.isArray(values.target_disease)) {
        protocol.targetDisease = values.target_disease.map((disease) => ({
          coding: [{ system: 'http://snomed.info/sct', code: String(disease) }],
          text: String(disease),
        }));
      }
      if (values.dose_number !== undefined) protocol.doseNumberPositiveInt = values.dose_number;
      if (values.doses_in_series !== undefined) protocol.seriesDosesPositiveInt = values.doses_in_series;
      if (Object.keys(protocol).length > 0) resource.protocolApplied = [protocol];
      delete (resource as { targetDisease?: unknown }).targetDisease;

      const vaccineCode = resource.vaccineCode as { coding?: { system?: string }[] } | undefined;
      if (vaccineCode?.coding?.[0]) vaccineCode.coding[0].system = 'http://snomed.info/sct';
      if (values.patient_birth_date) {
        (resource.patient as Record<string, unknown>).birthDate = values.patient_birth_date;
      }
      if (values.next_dose_due) {
        // FHIR models a due date as a separate ImmunizationRecommendation; a
        // note on the series keeps it visible without misusing a field.
        const applied = (resource.protocolApplied ??= [{}]) as Record<string, unknown>[];
        if (applied[0]) applied[0].series = `next dose due ${String(values.next_dose_due)}`;
      }
      return {
        resource,
        unmapped: unmappedClaims(definition, values, [
          'target_disease',
          'dose_number',
          'doses_in_series',
          'next_dose_due',
          'patient_birth_date',
          'country',
        ]),
      };
    }

    default:
      throw new Error(`no FHIR projection is implemented for resource type ${resourceType}`);
  }
}

function patientDisplay(values: Record<string, unknown>, given: string, family: string): string {
  return [values[given], values[family]].filter(Boolean).join(' ') || 'unknown';
}

function nameIntoBeneficiary(
  resource: Record<string, unknown>,
  values: Record<string, unknown>,
  given: string,
  family: string,
  birth: string,
): void {
  // Only materialise `beneficiary` when something was actually disclosed for
  // it — an empty element would claim the holder released a name they did not.
  const hasName = Boolean(values[given] ?? values[family]);
  const hasBirthDate = Boolean(values[birth]);
  if (!hasName && !hasBirthDate) return;
  const beneficiary = (resource.beneficiary ??= {}) as Record<string, unknown>;
  if (hasName) beneficiary.display = patientDisplay(values, given, family);
  if (hasBirthDate) beneficiary.birthDate = values[birth];
}

function unmappedClaims(
  definition: CredentialDefinition,
  values: Record<string, unknown>,
  handledSeparately: string[],
): string[] {
  const handled = new Set(handledSeparately);
  return Object.keys(values).filter((name) => {
    if (handled.has(name)) return false;
    const claim = definition.claims.find((candidate) => candidate.name === name);
    return !claim?.semantics?.fhir?.path;
  });
}

/* --------------------------------------------------------------- openEHR */

export interface OpenEhrProjection {
  /** openEHR "flat format": template path → value. */
  composition: Record<string, unknown>;
  templateId: string;
  archetypeId: string;
  unmapped: string[];
}

/**
 * Build an openEHR flat-format composition from disclosed claims.
 *
 * The output is exactly what an openEHR CDR's flat-format endpoint accepts —
 * for a deployment that runs one, and a deployment can do without one: the
 * same structure can be handed to a local analysis, written to a research
 * export, or thrown away after the consultation. Reusing the archetype paths
 * costs nothing and keeps the door open; requiring a repository would close it.
 */
export function projectToOpenEhr(
  definition: CredentialDefinition,
  values: Record<string, unknown>,
): OpenEhrProjection {
  const openehr = definition.semantics?.openehr;
  if (!openehr) {
    throw new Error(`${definition.vct} declares no openEHR template`);
  }

  const composition: Record<string, unknown> = {};
  const unmapped: string[] = [];

  for (const claim of definition.claims) {
    const value = values[claim.name];
    if (value === undefined || value === null) continue;

    if (claim.nested && Array.isArray(value)) {
      // Repeating nodes are indexed with openEHR's `:n` flat-path suffix.
      value.forEach((element, index) => {
        for (const child of claim.nested ?? []) {
          const childValue = (element as Record<string, unknown>)[child.name];
          if (childValue === undefined || childValue === null) continue;
          const path = child.semantics?.openehr?.path;
          if (!path) {
            unmapped.push(`${claim.name}[${index}].${child.name}`);
            continue;
          }
          composition[indexFlatPath(path, index)] = childValue;
        }
      });
      continue;
    }

    const path = claim.semantics?.openehr?.path;
    if (!path) {
      unmapped.push(claim.name);
      continue;
    }
    composition[path] = value;
  }

  // Minimum context every openEHR composition needs to be well formed.
  const root = openehr.templateId.split('.')[1] ?? 'composition';
  composition[`${root}/language|code`] = 'de';
  composition[`${root}/territory|code`] = 'CH';
  composition[`${root}/composer|name`] = 'swiyu wallet holder';

  return {
    composition,
    templateId: openehr.templateId,
    archetypeId: openehr.archetypeId,
    unmapped,
  };
}

/**
 * Insert a repetition index into a flat path. openEHR indexes the *repeating*
 * node, which in these templates is the second-to-last segment.
 */
function indexFlatPath(path: string, index: number): string {
  const segments = path.split('/');
  const position = Math.max(segments.length - 2, 0);
  const segment = segments[position];
  if (segment !== undefined) segments[position] = `${segment}:${index}`;
  return segments.join('/');
}
