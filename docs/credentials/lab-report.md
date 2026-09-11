# Laboratory Report

Laboratory findings from a medical consultation.

| | |
| --- | --- |
| **`vct`** | `urn:vct:ch.didas.health.lab-report:1.0` |
| **Configuration id** | `health_lab_report_sd_jwt` |
| **Format** | `dc+sd-jwt` |
| **Profile** | `swiss-profile-vc:1.0.0` |
| **Refreshable** | no |
| **Claims** | 10 |

### Displayed as

| Locale | Name | Description |
| --- | --- | --- |
| `de-CH` | Laborbefund | Laborbefund einer ärztlichen Konsultation. |
| `fr-CH` | Rapport de laboratoire | Rapport de laboratoire d'une consultation médicale. |
| `it-CH` | Referto di laboratorio | Referto di laboratorio di una consultazione medica. |
| `en-GB` | Laboratory Report | Laboratory findings from a medical consultation. |

## Governance

**Who may issue it** — `ch.didas.health.role.laboratory`.

A laboratory authorised under the KVG analysis list, or the treating practice issuing on its behalf; either way the issuing DID must carry the authorization marker for this credential type.

This is a **governed** credential type: an actor must decline any interaction where the counterparty carries the Governed Use Case Trust Marker without the matching authorization marker.

### Who may request it

| Role | Purpose | Claims permitted | Protected fields |
| --- | --- | --- | --- |
| `ch.didas.health.role.practice` | Read the findings during a consultation | 10 of 10 | — |
| `ch.didas.health.role.research` | Secondary use under explicit, revocable patient consent | 3 of 10 | — |

A request for any claim outside a role's entitlement is refused when the query is
built, before it reaches the holder. See `reviewRequest()`.

**Revocation** — The issuing laboratory revokes on a corrected or withdrawn result. The patient keeps the superseded credential in the wallet but it no longer verifies, which is the behaviour a corrected finding needs.

**Retention** — A verifying practice may retain the findings in the treatment record; a research recipient may retain only what the consent covers, and never the identifying claims.

## Clinical models

The models are reused; the repository is not. A verifier rebuilds these
representations locally from the claims the holder released — see
[F-07](../../flows/F-07-model-projection.md).

| Standard | Type | Profile / archetype |
| --- | --- | --- |
| HL7 FHIR | `DiagnosticReport` | `http://hl7.org/fhir/StructureDefinition/DiagnosticReport` |
| openEHR | `DIDAS.laboratory_report.v0` | `openEHR-EHR-OBSERVATION.laboratory_test_result.v1` |

## Claims

Every claim is selectively disclosable — the Swiss Profile forbids
non-disclosable business claims outright, which is what makes a four-claim
presentation of an eighteen-claim credential possible.

| Claim | Label | Type | Constraint | Semantic binding | Notes |
| --- | --- | --- | --- | --- | --- |
| `report_id` | Report number | Text | string, ≤ 64 chars | — | required |
| `patient_given_name` | Given name(s) | Text | string, ≤ 200 chars | — | required |
| `patient_family_name` | Surname | Text | string, ≤ 200 chars | — | required |
| `patient_birth_date` | Date of birth | DateTime | string, date | — | required |
| `findings` | Findings | Array[Reference] | object | — | required |
| `interpretation` | Assessment | Text | string, ≤ 2000 chars | FHIR `DiagnosticReport.conclusion`<br>openEHR `laboratory_report/laboratory_test_result/any_event/conclusion` | masked in the wallet |
| `specimen_date` | Specimen date | DateTime | string, date | FHIR `Specimen.collection.collectedDateTime`<br>openEHR `laboratory_report/laboratory_test_result/any_event/specimen/collection/time` | required |
| `report_date` | Report date | DateTime | string, date | FHIR `DiagnosticReport.issued` | required |
| `laboratory_name` | Laboratory | Text | string, ≤ 200 chars | — | required |
| `ordering_physician_gln` | Ordering physician GLN | Text | string, `^[0-9]{13}$` | — | required |

### `findings` — nested claims

A selectively disclosable array of objects, using array-element and recursive disclosures.

| Claim | Label | Type | Constraint | Semantic binding | Notes |
| --- | --- | --- | --- | --- | --- |
| `loinc_code` | LOINC | Text | string, `^[0-9]{1,5}-[0-9]$` | FHIR `Observation.code.coding.code`<br>openEHR `laboratory_report/laboratory_test_result/any_event/test_name`<br>LOINC (`http://loinc.org`) | required |
| `analyte` | Analyte | Text | string, ≤ 200 chars | FHIR `Observation.code.text`<br>openEHR `laboratory_report/laboratory_test_result/any_event/analyte_result/analyte_name` | required |
| `value` | Value | Text | string, ≤ 100 chars | FHIR `Observation.valueQuantity.value`<br>openEHR `laboratory_report/laboratory_test_result/any_event/analyte_result/result_value` | required |
| `unit` | Unit | Text | string, ≤ 50 chars | FHIR `Observation.valueQuantity.unit`<br>UCUM (`http://unitsofmeasure.org`) | required |
| `reference_range` | Reference range | Text | string, ≤ 100 chars | FHIR `Observation.referenceRange.text`<br>openEHR `laboratory_report/laboratory_test_result/any_event/analyte_result/reference_range_guidance` | required |
| `flag` | Interpretation | Text | string, one of NORMAL, LOW, HIGH, CRITICAL | FHIR `Observation.interpretation.coding.code`<br>ObservationInterpretation (`http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation`) | required |

## Generated artefacts

Produced by `npm run generate:config`, bound to each other by SRI hash:

| Artefact | Path | Served at |
| --- | --- | --- |
| SD-JWT VC Type Metadata | `config/<actor>/credentials/health-lab-report-sd-jwt/vct.json` | `/oid4vci/vct/health-lab-report-sd-jwt` |
| JSON Schema | `config/<actor>/credentials/health-lab-report-sd-jwt/schema.json` | `/oid4vci/json-schema/health-lab-report-sd-jwt` |
| OCA bundle | `config/<actor>/credentials/health-lab-report-sd-jwt/oca.json` | `/oid4vci/oca/health-lab-report-sd-jwt` |

---

*Generated from `packages/swiyu/src/credentials/lab-report.ts`. Do not edit by hand.*
