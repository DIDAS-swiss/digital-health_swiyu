# Swiss Profile conformance

Every rule this project enforces, and where it comes from. Rules marked
**checked** are asserted by `packages/swiyu/src/conformance.ts` and covered by
`packages/swiyu/test/conformance.test.ts`; a violation fails the build or the
request, ahead of a wallet that would silently refuse to connect.

Profiles are pinned in `packages/swiyu/src/profile.ts` — one file to change when
the profile moves.

## Cryptography · all profiles

| Rule | Source | Status |
| --- | --- | --- |
| JWS algorithm MUST be ES256 | all four profiles, "Cryptography" | **checked** in issuer metadata |
| Encryption MUST be ECDH-ES with P-256 | issuance, verification, vc | emitted in metadata |
| Hash function MUST be sha-256 | vc | used for SRI and CESR digests |
| `did:webvh` hash SHA-256, cryptosuite `eddsa-jcs-2022` | anchor | onboarding |

## swiss-profile-issuance:1.0.0 · OpenID4VCI 1.0 + DPoP

| Rule | Source | Status |
| --- | --- | --- |
| `profile_version` REQUIRED in metadata body and JWT headers | §12.2.4 | **checked** |
| Only `dc+sd-jwt`; ISO mdoc and W3C VCDM NOT SUPPORTED | §3.3.1 | **checked** |
| Pre-authorized code flow MUST be supported; authorization code flow NOT | §3.3.3, §3.4 | only flow used |
| `authorization_details` and `scope` NOT SUPPORTED | §3.3.4, §12.2.4 | **checked** |
| `nonce_endpoint` REQUIRED | §12.2.4 | **checked** |
| `authorization_servers`, `notification_endpoint` NOT SUPPORTED | §12.2.4 | **checked** |
| `credential_request_encryption.encryption_required` MUST be true | §12.2.4 | **checked** |
| `credential_response_encryption.encryption_required` MUST be true | §12.2.4 | **checked** |
| `cryptographic_binding_methods_supported` MUST be `jwk` | §12.2.4 | **checked** |
| `proof_types_supported` MUST be `jwt` | §12.2.4 | **checked** |
| `batch_size` MUST be ≥ 10 | §14.A | **checked** |
| Logos MUST be base64 data URLs, png or jpeg | §12.2.4 | **checked** |
| `claims[].mandatory` NOT SUPPORTED | §12.2.4 | **checked** |
| `display[].background_image`, `text_color` NOT SUPPORTED | §12.2.4 | **checked** |
| Signed metadata MUST be provided and used | §12.2.3 | generic issuer |
| Token and credential requests MUST carry DPoP | §6, §8.2 | generic issuer |
| Key attestation for hardware-bound credentials | Appendix D | generic issuer |
| Batch payload limit 20 MB | §8.3 | documented in `LIMITS` |

## swiss-profile-verification:1.0.0 · OpenID4VP 1.0 + JAR

| Rule | Source | Status |
| --- | --- | --- |
| `profile_version` REQUIRED in the JAR header | §5 | generic verifier |
| Verifiers MUST send a signed JAR | §5 | **checked** |
| `response_mode` MUST be `direct_post.jwt` | §5.2, §8 | **checked** |
| `client_id` MUST be the verifier's DID, `decentralized_identifier:` prefix | §5.9 | generic verifier |
| DCQL `multiple` NOT SUPPORTED | §6.1 | **checked** |
| Trusted authorities MUST use the `did` type | §6.1.1 | **checked** |
| ISO mdoc claim semantics NOT SUPPORTED | §7.2 | **checked** via format |
| `transaction_data` NOT SUPPORTED | §5.1, §8.4 | not used |
| `request_uri_method` post NOT SUPPORTED | §5.10 | not used |
| `aud` of the request object MUST be `https://self-issued.me/v2` | §5.8 | generic verifier |
| Wallet schemes `openid4vp://` and `swiyu-verify://` | §9 | generic verifier |
| Authorization response size 21 MB | §13 | documented in `LIMITS` |

Beyond the profile, `checkVerificationRequest()` refuses a request that sets
neither `accepted_issuer_dids` nor `trust_anchors`. The profile does not spell
this out, but `swiss-profile-trust` requires an actor to be able to evaluate its
counterparty's trust markers, and accepting every issuer DID makes that
impossible.

## swiss-profile-vc:1.0.0 · SD-JWT VC, Token Status List, OCA

| Rule | Source | Status |
| --- | --- | --- |
| `profile_version` REQUIRED in VCT body and OCA bundle | §5, OCA | **checked** |
| Media type MUST be `application/dc+sd-jwt` | §9.11 | constant |
| Every business claim MUST be selectively disclosable | §3.2.2.4 | credential definitions |
| `_sd_alg` MUST be sha-256; decoy digests NOT SUPPORTED | §4.1.1, §4.2.5 | generic issuer |
| Array-element and recursive disclosures MUST be supported | §4.2.2, §4.2.6 | used for `medication`, `findings` |
| Structured SD-JWT NOT SUPPORTED; flat and recursive only | §6.3 | credential definitions |
| Status types limited to VALID, INVALID, SUSPENDED | §7.1 | `TOKEN_STATUS` |
| CBOR/CWT/COSE status lists NOT SUPPORTED | §4.3, §5.2, §6.3 | JWT only |
| Status list aggregation and historical resolution NOT SUPPORTED | §8.4, §9 | not used |
| Status provider MUST be the FOITT registry | §12.1 | deployment |
| Status list token > 200 bytes, ≤ 200 KB | §13 | `LIMITS`, enforced on create |
| `exp` REQUIRED on the status list token; `iat` within 24 h | §13 | generic issuer |
| `expiry_date` is a disclosure; `exp` MUST NOT be | §3.2.2.2 | credential definitions |
| Type Metadata `extends` NOT SUPPORTED | §5.2 | generator emits none |
| Rendering `simple` and `svg_templates` NOT SUPPORTED | §7.1.1–2 | OCA only |
| Claim metadata NOT SUPPORTED | §8 | not emitted |
| OCA: exactly one root Capture Base | OCA, bundle | **checked** |
| OCA: `classification`, `flagged_attributes` NOT SUPPORTED | OCA, Capture Base | **checked** |
| OCA: overlay set limited to the profile's list | OCA, Overlays | **checked** |
| OCA: Branding Overlay media MUST be data URLs | OCA, Branding | **checked** |
| OCA: Label 1.1, Branding 1.1, Data Source 2.0, Order 1.0 | OCA, Additional Overlays | generated |
| CESR SHA-256 self-addressing digests | OCA, CESR encoding | `cesr.ts`, tested |

## swiss-profile-anchor:1.0.0 · DID Core + did:webvh

| Rule | Source | Status |
| --- | --- | --- |
| `kid` MUST be an absolute `{DID}#{key}`; neither part may contain `#` | JWT validation | generic components |
| `iss` is optional and MUST be ignored if present | JWT validation | generic components |
| `publicKeyJwk` REQUIRED; `publicKeyMultibase` MUST NOT be used | §5.2.1 | onboarding |
| `service`, `alsoKnownAs`, `keyAgreement`, `capability*` NOT SUPPORTED | §5, §5.3 | onboarding |
| `portable` false, `witness` `{}`, `watchers` `[]` | §3.7.1 | onboarding |
| `/whois` and did:web fallback NOT SUPPORTED | §2.1, §3.8 | Trust Protocol instead |

## Trust Protocol 2.0 · swiss-profile-trust:1.0

| Rule | Source | Status |
| --- | --- | --- |
| MUST decline `gucTM` without `gucaTM` | Trust requirements | enforced under every policy |
| SHOULD decline without `viTM` | Trust requirements | strict policy; waiver recorded under sandbox |
| MAY decline without `caTM` / `tvTM` | Trust requirements | strict policy |
| `personal_administrative_number` is a protected field | Protected fields | enforced at query construction; refuses without entitlement |

## Change dossiers tracked

| CD | Effect here |
| --- | --- |
| CD-001 Actors restriction, Sandbox/prod separation | `did:webvh` only; Sandbox Wallet only; Sandbox hosts in `SANDBOX` |
| CD-002 Issuer security enforcements | generic issuer |
| CD-004 Verifier security enforcements | generic verifier |
| CD-005 DPoP enforcement | generic issuer |
| CD-006 Trust Protocol 2.0 | marker model in `governance.ts` |
| CD-007 Ed25519VerificationKey removed | ES256 / P-256 only |

## What is not covered

The bundled mock performs **no signing, no DPoP, no encryption and no DID
resolution**. Everything attributed above to "generic issuer" or "generic
verifier" is unexercised when `SWIYU_MODE=mock`. Protocol conformance is
established by running against real generic components and, for the wallet side,
against the [swiyu generic application
test](https://github.com/swiyu-admin-ch/swiyu-generic-application-test) and
[test wallet](https://github.com/swiyu-admin-ch/swiyu-generic-test-wallet).
