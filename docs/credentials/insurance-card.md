# Swiss Health Insurance Card

Electronic insurance card for Swiss mandatory health insurance.

| | |
| --- | --- |
| **`vct`** | `urn:vct:ch.didas.health.insurance-card:1.0` |
| **Configuration id** | `health_insurance_card_sd_jwt` |
| **Format** | `dc+sd-jwt` |
| **Profile** | `swiss-profile-vc:1.0.0` |
| **Refreshable** | yes |
| **Claims** | 11 |

### Displayed as

| Locale | Name | Description |
| --- | --- | --- |
| `de-CH` | Versichertenkarte | Elektronische Versichertenkarte der obligatorischen Krankenpflegeversicherung. |
| `fr-CH` | Carte d'assuré | Carte d'assuré électronique de l'assurance obligatoire des soins. |
| `it-CH` | Tessera di assicurato | Tessera di assicurato elettronica dell'assicurazione obbligatoria delle cure medico-sanitarie. |
| `en-GB` | Health Insurance Card | Electronic insurance card for Swiss mandatory health insurance. |

## Governance

**Who may issue it** — `ch.didas.health.role.insurer`.

KVG/LAMal Art. 42a — the insurer issues the insurance card.

This is a **governed** credential type: an actor must decline any interaction where the counterparty carries the Governed Use Case Trust Marker without the matching authorization marker.

### Who may request it

| Role | Purpose | Claims permitted | Protected fields |
| --- | --- | --- | --- |
| `ch.didas.health.role.practice` | Establish cover and billing route at check-in | 10 of 11 | `personal_administrative_number` |
| `ch.didas.health.role.pharmacy` | Confirm cover before dispensing a reimbursed medication | 4 of 11 | — |

A request for any claim outside a role's entitlement is refused when the query is
built, before it reaches the holder. See `reviewRequest()`.

**Revocation** — The insurer revokes on termination of cover or card replacement; the status list bit flips and every later presentation fails without the patient having to return anything.

**Retention** — A practice may keep the disclosed claims for as long as the billing record requires (10 years under OR Art. 958f); a pharmacy only for the duration of the dispensation.

## Clinical models

The models are reused; the repository is not. A verifier rebuilds these
representations locally from the claims the holder released — see
[F-07](../../flows/F-07-model-projection.md).

| Standard | Type | Profile / archetype |
| --- | --- | --- |
| HL7 FHIR | `Coverage` | `http://fhir.ch/ig/ch-core/StructureDefinition/ch-core-coverage` |

## Claims

Every claim is selectively disclosable — the Swiss Profile forbids
non-disclosable business claims outright, which is what makes a four-claim
presentation of an eighteen-claim credential possible.

| Claim | Label | Type | Constraint | Semantic binding | Notes |
| --- | --- | --- | --- | --- | --- |
| `given_name` | Given name(s) | Text | string, ≤ 200 chars | — | required |
| `family_name` | Surname | Text | string, ≤ 200 chars | — | required |
| `birth_date` | Date of birth | DateTime | string, date | — | required |
| `card_number` | Card number | Text | string, `^807560[0-9]{14}$` | FHIR `Coverage.identifier.value`<br>VEKA (`urn:oid:2.16.756.5.30.1.123.100.1.1.1`) | required |
| `personal_administrative_number` | Social security number | Text | string, `^756\.[0-9]{4}\.[0-9]{4}\.[0-9]{2}$` | FHIR `Coverage.beneficiary.identifier.value`<br>AHVN13 (`urn:oid:2.16.756.5.32`) | required, **protected field**, masked in the wallet |
| `insurer_name` | Insurer | Text | string, ≤ 200 chars | FHIR `Coverage.payor.display` | required |
| `insurer_ber_number` | Enterprise register number | Text | string, ≤ 32 chars | FHIR `Coverage.payor.identifier.value`<br>BER (`urn:oid:2.16.756.5.45`) | required |
| `insurance_model` | Model | Text | string, one of STANDARD, HMO, HAUSARZT, TELMED | — | required |
| `coverage` | Coverage | Array[Text] | array | FHIR `Coverage.type.coding.code` | required |
| `valid_from` | Valid from | DateTime | string, date | FHIR `Coverage.period.start` | required |
| `expiry_date` | Valid until | DateTime | string, date | — | required |

## Generated artefacts

Produced by `npm run generate:config`, bound to each other by SRI hash:

| Artefact | Path | Served at |
| --- | --- | --- |
| SD-JWT VC Type Metadata | `config/<actor>/credentials/health-insurance-card-sd-jwt/vct.json` | `/oid4vci/vct/health-insurance-card-sd-jwt` |
| JSON Schema | `config/<actor>/credentials/health-insurance-card-sd-jwt/schema.json` | `/oid4vci/json-schema/health-insurance-card-sd-jwt` |
| OCA bundle | `config/<actor>/credentials/health-insurance-card-sd-jwt/oca.json` | `/oid4vci/oca/health-insurance-card-sd-jwt` |

---

*Generated from `packages/swiyu/src/credentials/insurance-card.ts`. Do not edit by hand.*
