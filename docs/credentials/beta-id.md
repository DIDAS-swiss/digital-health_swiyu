# Beta-ID

Sandbox pseudo-identity credential carrying the attribute set of the future e-ID.

| | |
| --- | --- |
| **`vct`** | `betaid-sdjwt` |
| **Configuration id** | `betaid_sd_jwt` |
| **Format** | `dc+sd-jwt` |
| **Profile** | `swiss-profile-vc:1.0.0` |
| **Refreshable** | unspecified |
| **Claims** | 5 |

### Displayed as

| Locale | Name | Description |
| --- | --- | --- |
| `de-CH` | Beta-ID | Pseudo-Identitätsnachweis der Sandbox mit den Attributen der künftigen E-ID. |
| `fr-CH` | Beta-ID | — |
| `it-CH` | Beta-ID | — |
| `en-GB` | Beta-ID | Sandbox pseudo-identity credential carrying the attribute set of the future e-ID. |

## Governance

This credential type carries no governance block, because this project does
not govern it. See the issuing authority.



## Claims

Every claim is selectively disclosable — the Swiss Profile forbids
non-disclosable business claims outright, which is what makes a four-claim
presentation of an eighteen-claim credential possible.

| Claim | Label | Type | Constraint | Semantic binding | Notes |
| --- | --- | --- | --- | --- | --- |
| `given_name` | Given name(s) | Text | string | — | — |
| `family_name` | Surname | Text | string | — | — |
| `birth_date` | Date of birth | DateTime | string, date | — | — |
| `age_over_18` | Over 18 | Boolean | boolean | — | — |
| `personal_administrative_number` | Social security number | Text | string | — | **protected field** |

## Generated artefacts

Produced by `npm run generate:config`, bound to each other by SRI hash:

| Artefact | Path | Served at |
| --- | --- | --- |
| SD-JWT VC Type Metadata | `config/<actor>/credentials/betaid-sd-jwt/vct.json` | `/oid4vci/vct/betaid-sd-jwt` |
| JSON Schema | `config/<actor>/credentials/betaid-sd-jwt/schema.json` | `/oid4vci/json-schema/betaid-sd-jwt` |
| OCA bundle | `config/<actor>/credentials/betaid-sd-jwt/oca.json` | `/oid4vci/oca/betaid-sd-jwt` |

---

*Generated from `packages/swiyu/src/credentials/betaid_sd_jwt.ts`. Do not edit by hand.*
