# Swiss Electronic Prescription

Electronic prescription issued by the treating physician.

| | |
| --- | --- |
| **`vct`** | `urn:vct:ch.didas.health.prescription:1.0` |
| **Configuration id** | `health_prescription_sd_jwt` |
| **Format** | `dc+sd-jwt` |
| **Profile** | `swiss-profile-vc:1.0.0` |
| **Refreshable** | no |
| **Claims** | 10 |

### Displayed as

| Locale | Name | Description |
| --- | --- | --- |
| `de-CH` | Rezept | Elektronisches Rezept, ausgestellt durch die behandelnde Ärztin oder den behandelnden Arzt. |
| `fr-CH` | Ordonnance | Ordonnance électronique établie par le médecin traitant. |
| `it-CH` | Ricetta | Ricetta elettronica rilasciata dal medico curante. |
| `en-GB` | Prescription | Electronic prescription issued by the treating physician. |

## Governance

**Who may issue it:** `ch.didas.health.role.practice`.

The authority to prescribe medicinal products results from the applicable professional-practice and therapeutic-products legislation, including MedBG/LPMéd, HMG/LPTh and cantonal law. The authorisation model should be verified for the intended issuer population before deployment. In a deployed ecosystem the governing actor would publish an authorisation statement naming this credential type for the practice, from which a verifier evaluation can derive the Governed Use Case Authorization Trust Marker

This is a **governed** credential type: an actor must decline any interaction for which the Trust Protocol evaluation derives the Governed Use Case Trust Marker without the matching Governed Use Case Authorization Trust Marker.

### Who may request it

| Role | Purpose | Claims permitted | Protected fields |
| --- | --- | --- | --- |
| `ch.didas.health.role.pharmacy` | Dispense the prescribed medication | 10 of 10 | n/a |
| `ch.didas.health.role.practice` | Reconcile current medication during a follow-up consultation | 4 of 10 | n/a |

The table above is this demonstrator's candidate per-credential proportionality and
request-minimisation model. The role, purpose and maximum claim set are project governance
choices; they do not assert that swiyu or applicable law defines those exact sets.
Within this model, a request is treated as over-broad when it asks for a claim outside
the role's listed entitlement, or for a protected field without the applicable
authorisation. Such requests are refused when the query is built, before they reach
the holder. See `reviewRequest()`.

**Revocation.** The pharmacy that dispenses asks the issuing practice to revoke, which is what makes the prescription single-use: redemption is a status change on the public status list the patient cannot see.

**Retention.** A pharmacy keeps the dispensation record under HMG/LPTh; the credential itself is not retained beyond the dispensation.

## Clinical models

The models are reused; the repository is not. A verifier rebuilds these
representations locally from the claims the holder released, see
[F-07](../../flows/F-07-model-projection.md).

| Standard | Type | Profile / archetype |
| --- | --- | --- |
| HL7 FHIR | `MedicationRequest` | `http://fhir.ch/ig/ch-emed/StructureDefinition/ch-emed-medicationrequest` |
| openEHR | `DIDAS.medication_order.v0` | `openEHR-EHR-INSTRUCTION.medication_order.v3` |

## Claims

Under `swiss-profile-vc:1.0.0` §3.2.2.4 an SD-JWT VC may carry only
selectively disclosable claims, apart from the registered JWT claims that
§3.2.2.2 lists; anything else must be rejected. So every claim in the table
below is one the holder releases or withholds, and the credential cannot
make any of them mandatory to release.

Which claims are asked for is the verifier's decision and the credential
format does not constrain it. For credential types governed by this demonstrator,
the Governance section above records a candidate proportionality and
request-minimisation model as a role, a purpose and a maximum claim set.
Those exact sets are project governance choices, not Swiss Profile requirements
or legal determinations.

The verifier also provides the intended query shape — its purpose, scope and
DCQL query — through a Verification Query Public Statement, see
[governance framework](../governance-framework.md#transparency-the-vqps).
The vqPS makes the intended verification scope reviewable; transparency does not
by itself establish that the request is proportionate.

| Claim | Label | Type | Constraint | Semantic binding | Notes |
| --- | --- | --- | --- | --- | --- |
| `prescription_id` | Prescription number | Text | string, ≤ 64 chars | n/a | required |
| `patient_given_name` | Given name(s) | Text | string, ≤ 200 chars | n/a | required |
| `patient_family_name` | Surname | Text | string, ≤ 200 chars | n/a | required |
| `patient_birth_date` | Date of birth | DateTime | string, date | n/a | required |
| `medication` | Medication | Array[Reference] | object | n/a | required |
| `prescriber_name` | Prescriber | Text | string, ≤ 200 chars | n/a | required |
| `prescriber_gln` | GLN | Text | string, `^[0-9]{13}$` | FHIR `MedicationRequest.requester.identifier.value`<br>GLN (`urn:oid:2.51.1.3`) | required |
| `issued_date` | Date of issue | DateTime | string, date | FHIR `MedicationRequest.authoredOn` | required |
| `expiry_date` | Valid until | DateTime | string, date | n/a | required |
| `repeats_authorized` | Repeats | Numeric | integer, 0 to 12 | n/a | required |

### `medication` · nested claims

A selectively disclosable array of objects, using array-element and recursive disclosures.

| Claim | Label | Type | Constraint | Semantic binding | Notes |
| --- | --- | --- | --- | --- | --- |
| `name` | Product | Text | string, ≤ 300 chars | FHIR `MedicationRequest.medicationCodeableConcept.text`<br>openEHR `medication_order/order/medication_item`<br>&nbsp;&nbsp;↳ `Medication item` in `openEHR-EHR-INSTRUCTION.medication_order.v3` | required |
| `gtin` | GTIN | Text | string, `^[0-9]{13,14}$` | FHIR `MedicationRequest.medicationCodeableConcept.coding.code`<br>openEHR `medication_order/order/medication_details/name`<br>&nbsp;&nbsp;↳ `Name` in `openEHR-EHR-CLUSTER.medication.v2`<br>GTIN (`urn:oid:2.51.1.1`) | n/a |
| `dosage` | Dosage | Text | string, ≤ 300 chars | FHIR `MedicationRequest.dosageInstruction.text`<br>openEHR `medication_order/order/overall_directions_description`<br>&nbsp;&nbsp;↳ `Overall directions description` in `openEHR-EHR-INSTRUCTION.medication_order.v3` | required |
| `quantity` | Quantity | Numeric | integer, 1 to 1000 | FHIR `MedicationRequest.dispenseRequest.quantity.value`<br>openEHR `medication_order/order/dispense_directions/dispense_amount`<br>&nbsp;&nbsp;↳ `Dispense amount` in `openEHR-EHR-INSTRUCTION.medication_order.v3` | required |
| `substitution_allowed` | Substitution allowed | Boolean | boolean | FHIR `MedicationRequest.substitution.allowedBoolean` | required |

## Generated artefacts

Produced by `npm run generate:config`, bound to each other by SRI hash:

| Artefact | Path | Served at |
| --- | --- | --- |
| SD-JWT VC Type Metadata | `config/<actor>/credentials/health-prescription-sd-jwt/vct.json` | `/oid4vci/vct/health-prescription-sd-jwt` |
| JSON Schema | `config/<actor>/credentials/health-prescription-sd-jwt/schema.json` | `/oid4vci/json-schema/health-prescription-sd-jwt` |
| OCA bundle | `config/<actor>/credentials/health-prescription-sd-jwt/oca.json` | `/oid4vci/oca/health-prescription-sd-jwt` |

---

*Generated from `packages/swiyu/src/credentials/prescription.ts`. Do not edit by hand.*
