# Immunization Record

Proof of one administered vaccination, issued by whoever administered it.

| | |
| --- | --- |
| **`vct`** | `urn:vct:ch.didas.health.immunization:1.0` |
| **Configuration id** | `health_immunization_sd_jwt` |
| **Format** | `dc+sd-jwt` |
| **Profile** | `swiss-profile-vc:1.0.0` |
| **Refreshable** | no |
| **Claims** | 18 |

### Displayed as

| Locale | Name | Description |
| --- | --- | --- |
| `de-CH` | Impfeintrag | Nachweis einer verabreichten Impfung, ausgestellt durch die impfende Stelle. |
| `fr-CH` | Vaccination | Preuve d'une vaccination administrée, délivrée par le vaccinateur. |
| `it-CH` | Vaccinazione | Prova di una vaccinazione somministrata, rilasciata da chi la somministra. |
| `en-GB` | Immunization | Proof of one administered vaccination, issued by whoever administered it. |

## Governance

**Who may issue it** — `ch.didas.health.role.vaccinator`.

EpG/LEp and the cantonal authorisation to vaccinate — a practice, a pharmacy with a vaccination permit, or a company medical service. The issuing DID must carry a Governed Use Case Authorization Trust Marker naming this credential type, because "who is allowed to say that a vaccination happened" is precisely what a verifier needs to check..

This is a **governed** credential type: an actor must decline any interaction where the counterparty carries the Governed Use Case Trust Marker without the matching authorization marker.

### Who may request it

| Role | Purpose | Claims permitted | Protected fields |
| --- | --- | --- | --- |
| `ch.didas.health.role.practice` | Establish vaccination status before advising or vaccinating | 18 of 18 | — |
| `ch.didas.health.role.pharmacy` | Check the series before administering the next dose | 7 of 18 | — |
| `ch.didas.health.role.travel-clinic` | Confirm protection against a specific disease for travel advice | 4 of 18 | — |
| `ch.didas.health.role.research` | Secondary use under explicit, revocable patient consent | 4 of 18 | — |

A request for any claim outside a role's entitlement is refused when the query is
built, before it reaches the holder. See `reviewRequest()`.

**Revocation** — Only the issuer may revoke, and only to correct a recording error — never to withdraw a vaccination that took place. Revoking a dose credential does not undo the dose; it withdraws an assertion the issuer should not have made.

**Retention** — A verifier checking vaccination status retains the outcome its own record requires and discards the credential. A travel clinic needs to know the series is complete, and keeps that conclusion alone.

## Clinical models

The models are reused; the repository is not. A verifier rebuilds these
representations locally from the claims the holder released — see
[F-07](../../flows/F-07-model-projection.md).

| Standard | Type | Profile / archetype |
| --- | --- | --- |
| HL7 FHIR | `Immunization` | `http://fhir.ch/ig/ch-vacd/StructureDefinition/ch-vacd-immunization` |
| openEHR | `DIDAS.immunisation.v0` | `openEHR-EHR-ACTION.medication.v1` |

## Claims

Every claim is selectively disclosable — the Swiss Profile forbids
non-disclosable business claims outright, which is what makes a four-claim
presentation of an eighteen-claim credential possible.

| Claim | Label | Type | Constraint | Semantic binding | Notes |
| --- | --- | --- | --- | --- | --- |
| `immunization_id` | Record number | Text | string, ≤ 64 chars | FHIR `Immunization.identifier.value` | required |
| `patient_given_name` | Given name(s) | Text | string, ≤ 200 chars | — | required |
| `patient_family_name` | Surname | Text | string, ≤ 200 chars | — | required |
| `patient_birth_date` | Date of birth | DateTime | string, date | — | required |
| `vaccine_code` | Vaccine code | Text | string, `^[0-9]{6,18}$` | FHIR `Immunization.vaccineCode.coding.code`<br>openEHR `immunisation/medication_management/medication_item/medication_details/name`<br>&nbsp;&nbsp;↳ `Name` in `openEHR-EHR-CLUSTER.medication.v2`<br>SNOMED CT (`http://snomed.info/sct`) | required |
| `vaccine_name` | Vaccine | Text | string, ≤ 300 chars | FHIR `Immunization.vaccineCode.text`<br>openEHR `immunisation/medication_management/medication_item`<br>&nbsp;&nbsp;↳ `Medication item` in `openEHR-EHR-ACTION.medication.v1` | required |
| `target_disease` | Protects against | Array[Text] | array | FHIR `Immunization.protocolApplied.targetDisease.coding.code`<br>SNOMED CT (`http://snomed.info/sct`) | required |
| `occurrence_date` | Date given | DateTime | string, date | FHIR `Immunization.occurrenceDateTime`<br>openEHR `immunisation/medication_management/time`<br>&nbsp;&nbsp;↳ `Medication management` in `openEHR-EHR-ACTION.medication.v1` | required |
| `dose_number` | Dose number | Numeric | integer, 1–20 | FHIR `Immunization.protocolApplied.doseNumberPositiveInt` | required |
| `doses_in_series` | Doses in series | Numeric | integer, 1–20 | FHIR `Immunization.protocolApplied.seriesDosesPositiveInt` | required |
| `next_dose_due` | Next dose due | DateTime | string, date | FHIR `Immunization.protocolApplied.series` | — |
| `lot_number` | Lot number | Text | string, ≤ 64 chars | FHIR `Immunization.lotNumber`<br>openEHR `immunisation/medication_management/medication_item/medication_details/batch_id`<br>&nbsp;&nbsp;↳ `Batch ID` in `openEHR-EHR-CLUSTER.medication.v2` | required |
| `route` | Route | Text | string, one of IM, SC, ID, PO, NASINHL | FHIR `Immunization.route.coding.code`<br>openEHR `immunisation/medication_management/route`<br>&nbsp;&nbsp;↳ `Route` in `openEHR-EHR-ACTION.medication.v1` | required |
| `site` | Site | Text | string, ≤ 100 chars | FHIR `Immunization.site.text` | — |
| `performer_name` | Administered by | Text | string, ≤ 200 chars | FHIR `Immunization.performer.actor.display` | required |
| `performer_gln` | GLN | Text | string, `^[0-9]{13}$` | FHIR `Immunization.performer.actor.identifier.value`<br>GLN (`urn:oid:2.51.1.3`) | required |
| `organization_name` | Location | Text | string, ≤ 200 chars | FHIR `Immunization.location.display` | required |
| `country` | Country | Text | string, `^[A-Z]{2}$` | ISO 3166-1 alpha-2 (`urn:iso:std:iso:3166`) | required |

## Generated artefacts

Produced by `npm run generate:config`, bound to each other by SRI hash:

| Artefact | Path | Served at |
| --- | --- | --- |
| SD-JWT VC Type Metadata | `config/<actor>/credentials/health-immunization-sd-jwt/vct.json` | `/oid4vci/vct/health-immunization-sd-jwt` |
| JSON Schema | `config/<actor>/credentials/health-immunization-sd-jwt/schema.json` | `/oid4vci/json-schema/health-immunization-sd-jwt` |
| OCA bundle | `config/<actor>/credentials/health-immunization-sd-jwt/oca.json` | `/oid4vci/oca/health-immunization-sd-jwt` |

---

*Generated from `packages/swiyu/src/credentials/immunization.ts`. Do not edit by hand.*
