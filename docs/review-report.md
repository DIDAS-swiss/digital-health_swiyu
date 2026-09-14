# Review report

Classification of the load-bearing statements in this repository, so a reviewer
can tell what the current Swiss Profiles support from what this demonstrator
implements from what it proposes the Swiss ecosystem should support next.

Read with [Swiss Profile conformance](spec-conformance.md), which traces each
enforced rule to its clause, [source verification](source-verification.md),
which records what was checked against a primary source, and
[Swiss Profile gaps](swiss-profile-gaps.md), which is the register the second
table below summarises.

Current as at 2026-09-13, against Swiss Profiles 1.0 and Trust Protocol 2.0, and
against [`writing-standard.md`](writing-standard.md) at `2026-09-13-2`.

## The five classifications

| Label | Meaning |
| --- | --- |
| **Current Swiss Profile** | The profile text states it. This repository enforces or relies on it |
| **DIDAS implementation choice** | A technical decision of this demonstrator. Another implementation could decide differently and still conform |
| **DIDAS governance choice** | A policy, role vocabulary or entitlement defined here. Not part of any profile and not standardised ecosystem vocabulary |
| **Beyond current Swiss Profile** | The mechanism is required by a flow and the current profiles do not define it |
| **Unresolved** | The repository cannot settle it: the profile is ambiguous, no body exists to decide it, or it has not been observed |

A statement being **implemented and tested here** is none of: deployed in
production, endorsed by the swiyu programme, reviewed by a standards body,
approved by counsel, or clinically validated. Nothing in this repository has run
against production swiyu.

## 1 · Statement classification

### Cryptography and formats

| File | Statement or mechanism | Classification | Source | Remaining caveat |
| --- | --- | --- | --- | --- |
| `profile.ts`, `spec-conformance.md` | JWS algorithm MUST be ES256 | Current Swiss Profile | All four profiles, "Cryptography" | Constrains the candidates for GP-08 and GP-09 |
| `spec-conformance.md` | Encryption MUST be ECDH-ES with P-256 | Current Swiss Profile | issuance, verification, vc | Emitted in metadata; not exercised under `SWIYU_MODE=mock` |
| `spec-conformance.md` | IETF SD-JWT VC is the credential format; W3C VCDM and ISO mdoc are NOT SUPPORTED | Current Swiss Profile | `swiss-profile-issuance:1.0.0` §3.3.1 | — |
| `README.md`, `articulation-pass.md` | Predicate proofs are not available in this profile | Current Swiss Profile | SD-JWT VC discloses or withholds a claim; the profile mandates that format and no other | The requirement behind it is GP-08 |

### Issuance

| File | Statement or mechanism | Classification | Source | Remaining caveat |
| --- | --- | --- | --- | --- |
| F-02, `spec-conformance.md` | The Pre-Authorized Code Flow is the one issuance flow available; the authorization code flow is NOT SUPPORTED | Current Swiss Profile | `swiss-profile-issuance:1.0.0` | — |
| F-02 | The status list exists before the credential that references it | DIDAS implementation choice | Ordering this project adopted; raised as Trust-Flow-Diagram-Repository issue 4 | The reference model orders it the other way |
| F-02 | The wallet fetches signed metadata, Type Metadata and an OCA bundle between the offer and the token request | Current Swiss Profile | `swiss-profile-vc:1.0.0`, OCA 1.0 | Absent from the reference model, hence issue 4 |
| F-02 | `vct_metadata_uri` carries an SRI integrity hash over the exact bytes served | Current Swiss Profile | `swiss-profile-vc:1.0.0` | Changing a deployment's external URL requires regenerating and re-signing |
| `credentials/*.ts` | One credential per administered dose | DIDAS implementation choice | This project's model of a dose as a single-author event | Series reconciliation across issuers is an open question, F-02 question 1 |

### Verification

| File | Statement or mechanism | Classification | Source | Remaining caveat |
| --- | --- | --- | --- | --- |
| `spec-conformance.md` | Verifiers MUST send a signed JAR; `response_mode` MUST be `direct_post.jwt` | Current Swiss Profile | `swiss-profile-verification:1.0.0` §5, §5.2, §8 | Generic verifier behaviour, unexercised in mock mode |
| `spec-conformance.md`, `conformance.ts` | DCQL `multiple` is NOT SUPPORTED | Current Swiss Profile | `swiss-profile-verification:1.0.0` §6.1 | The accompanying sentence is ambiguous; see the next row |
| `swiss-profile-gaps.md` GP-01 | Whether several Credential Queries may appear in one verification | **Unresolved** | §6.1 adds "only a single credential can be used in a verification", which does not settle the case | The narrow and broad readings differ, and the profile does not say which applies |
| F-04, `health-flow.likec4` | Two Credential Queries in one authorization request | DIDAS implementation choice, **under profile clarification** | OpenID4VP 1.0 defines several Credential Queries; the Swiss Profile is not explicit | Implemented and tested here. Not evidence of normative profile behaviour |
| `spec-conformance.md` | Trusted authorities MUST use the `did` type | Current Swiss Profile | `swiss-profile-verification:1.0.0` §6.1.1 | The DCQL trusted-authority types in base OID4VP do not apply |
| `dcql.ts` | `accepted_issuer_dids` is set per query | DIDAS implementation choice | Tightest control available to a verifier; enforced by `checkVerificationRequest()` | A pilot control; does not scale as a substitute for a role grant |

### Trust and governance

| File | Statement or mechanism | Classification | Source | Remaining caveat |
| --- | --- | --- | --- | --- |
| `governance.ts`, `spec-conformance.md` | An actor MUST decline a counterparty carrying `gucTM` without `gucaTM` | Current Swiss Profile | `swiss-profile-trust:1.0`, Trust requirements, at MUST level | Enforced under both policies; a test covers the Sandbox path |
| `governance.ts` | The SHOULD-level rules are waived under `SANDBOX_HEALTH_POLICY` and enforced under `STRICT_HEALTH_POLICY` | DIDAS governance choice | This project's two policy configurations | **Unresolved in practice**: the strict policy has never run against production swiyu, so this is a statement about a code path |
| `governance-framework.md` | `personal_administrative_number` is the one protected field and requires authorisation before a verifier may request it | Current Swiss Profile | `swiss-profile-trust:1.0`, Protected fields | Enforced at query construction here |
| `governance.ts` | `ch.didas.health.role.*`, eight roles with per-type issuance rights and per-claim entitlements | DIDAS governance choice | This repository's own vocabulary | **Not Trust Protocol role identifiers, not a Trust Protocol claim and not a marker.** A deployment may map the governance decision a role represents onto applicable authorisation statements; the identifier does not travel in the protocol |
| F-01, `governance-framework.md` | An issuer's authorisation to issue a governed credential type is expressed as a trust statement from which markers are derived | Current Swiss Profile for the mechanism; **Unresolved** in fact | Trust Protocol 2.0 defines the statement types; the Trust Registry publishes and serves them | No health-domain governance body exists, so no such statement has been issued for a health role |
| `governance-framework.md`, F-01, `types.ts` | A governing actor publishes applicable statements; an evaluating actor derives trust markers for one interaction; the relying party then decides | Current Swiss Profile | Trust Protocol 2.0 statement types and evaluation rules | A marker is an evaluation result. Where this repository names an implementation object a marker, as `IssuerTrustMarker` does, it is the generic verifier's response for one interaction and says so |
| `conformance.ts` | `purpose_description` capped at 500 characters | DIDAS implementation choice | The verifier management API's own limit, stricter than the protocol's 1000 | Marked `[project policy]` in the conformance table |
| `governance-framework.md` | The audit journal records claim names and no claim values | DIDAS governance choice | A test asserts that no AHV number and no vaccine lot number reaches the journal | Evidences which rules ran; it is not proof that an interaction occurred |
| `governance.ts` | A query naming a claim outside the requesting role's entitlement is rejected while the query is built | DIDAS governance choice | `reviewRequest()`, exercised by the DCQL builder tests | The entitlement model is this project's, not the profile's |

### Status and lifecycle

| File | Statement or mechanism | Classification | Source | Remaining caveat |
| --- | --- | --- | --- | --- |
| F-05, F-06 | The Generic Issuer records a credential as `REVOKED`; the Token Status List entry is published as `INVALID`; a verifier evaluating that entry no longer receives `VALID` | Current Swiss Profile for the mechanism; DIDAS implementation choice for the flow | Token Status List Draft 20 via `swiss-profile-vc:1.0.0` | Three distinct things. "The credential is invalid" is not used as shorthand for any of them |
| F-06, `articulation-pass.md` | The status-list representation carries no clinical payload and no patient attributes | Current Swiss Profile | IETF Token Status List: the entry is a status value at an index | — |
| F-06 | The status list carries no reason, so "used up" and "withdrawn" are separated only by the issuer's journal | Current Swiss Profile limitation | Token Status List Draft 20 | The requirement behind it is GP-06 |
| F-05 | Revoking a credential causes later presentations to fail | Current Swiss Profile requires status resolution; **Unresolved** in observation | The profile requires a verifier to resolve status | This repository cannot observe whether every deployed verifier does |
| F-06 | Correction issues a successor and revokes the predecessor, with no lineage expressed in the credential | DIDAS implementation choice | This project's correction model, following the CH VACD `relatesTo` shape at the clinical layer | The requirement behind it is GP-07 |

### Information models

| File | Statement or mechanism | Classification | Source | Remaining caveat |
| --- | --- | --- | --- | --- |
| `credentials/*.ts`, F-07 | Each claim is associated with a FHIR element path and, where one exists, an openEHR archetype path | DIDAS implementation choice | The definitions in this repository | Semantic equivalence depends on the profiles both systems apply, terminology bindings and implementation constraints |
| F-07 | The FHIR resource produced by a projection carries no signature | DIDAS implementation choice, with a consequence that is general | `projections.ts` emits a resource and no proof element; the test suite pins the shape | A derived representation does not inherit the cryptographic properties of its source. The requirement behind it is GP-02 |
| F-07 | `meta.profile` names the profile a resource is shaped towards; conformance to it is not asserted | DIDAS implementation choice | Stated in F-07 open question 2 | No resource has been run through a FHIR validator: the FHIR package registry is unreachable from this environment. One known non-conformance is recorded |
| `ehealth-suisse-alignment.md` | `CHCorePatientEPR` sets `EPR-SPID` and `AHVN13` to `0..0` | External standard | CH Core, read from `hl7ch/ch-core` | Verified against the FSH source on 2026-09-13 |
| F-07 | openEHR templates `DIDAS.immunisation.v0` and siblings | DIDAS implementation choice | Named in this repository | **Sketched and unpublished.** Real operational templates would have to be modelled and published |

### Disclosure and correlation

| File | Statement or mechanism | Classification | Source | Remaining caveat |
| --- | --- | --- | --- | --- |
| `site/index.html`, F-03 | The presentation request selects four claims of the eighteen the immunization type defines; the wallet opens the commitments the query names and leaves the others closed | Current Swiss Profile for the mechanism; DIDAS governance choice for which four | SD-JWT (RFC 9901) via `swiss-profile-vc:1.0.0`; the entitlement is in `credentials/immunization.ts` | Selective disclosure is not anonymity and not unlinkability |
| `README.md`, F-11 | The flow exposes no explicit person identifier; stable claim values, holder-binding material, status references, timing and network metadata may still permit correlation | Current Swiss Profile limitation | The surfaces are properties of the format and protocol | Named rather than claimed away. The requirement behind it is GP-09 |
| F-11 | Batch issuance would reduce the credential-level correlation surface | **Unresolved** | The profile supports batches of at least ten | This project does not use them, so the effect is reasoned rather than measured |
| F-11 | A zero-knowledge presentation would close the invitation-index correlation | **Unresolved** | A candidate scheme tracked in issue 10 | Depends on its fit with ES256 and the Swiss Profile |
| F-09 | A holder-controlled, revocable authorisation object with its own lifecycle | **Beyond current Swiss Profile** | No holder-as-issuer pattern is defined | GP-03. Distinct from wallet approval, from protocol authorisation and from legal or research consent |

### Composition and continuity

| File | Statement or mechanism | Classification | Source | Remaining caveat |
| --- | --- | --- | --- | --- |
| F-08 | Several instances of one credential type, count unknown when the request is built | **Beyond current Swiss Profile** | `multiple` is NOT SUPPORTED | GP-01. The requirement stands whichever way the multi-query question resolves |
| F-08 | Provenance from a verified presentation into an assembled IPS Bundle | **Beyond current Swiss Profile** | No mechanism defined | GP-02 |
| F-08 | Cross-border presentation to a verifier outside the Swiss trust domain | **Beyond current Swiss Profile** | Trust statements are evaluated within the Swiss trust domain | GP-10 |
| F-10 | Standing authorisation for a continuing exchange | **Beyond current Swiss Profile** | Each presentation is a discrete, separately approved interaction | GP-04 |
| F-10 | Measurement and device provenance | **Beyond current Swiss Profile** | Trust Protocol 2.0 defines `viTM`, `caTM`, `tvTM`, `gucTM`, `gucaTM`; device attestation is not among them | GP-05. Key attestation concerns key storage, not measurement origin |
| F-10 | The protocol for a continuing exchange | **Unresolved** | Recorded as `protocols: []` with `protocol_status: unresolved` | Whether such an exchange is local or multi-party is itself unresolved |

### Legal

| File | Statement or mechanism | Classification | Source | Remaining caveat |
| --- | --- | --- | --- | --- |
| `governance-framework.md` | Insurance card: KVG/LAMal Art. 42a, the insurer issues the card | External law, read against Fedlex | Fedlex, 2026-09-13 | Modelled basis. Legal review required before deployment |
| `governance-framework.md` | Prescription: applicable professional-practice and therapeutic-products legislation, including MedBG/LPMéd, HMG/LPTh and cantonal law | External law, read against Fedlex | Fedlex, 2026-09-13. Corrected: an earlier citation named only part of the applicable law | The authorisation model should be verified for the intended issuer population |
| `governance-framework.md` | Immunization: EpG/LEp, with professional, therapeutic-products and cantonal law deciding who may administer | External law, read against Fedlex | Fedlex, 2026-09-13 | Modelled basis |
| `governance-framework.md` | Laboratory report: a laboratory on the KVG analysis list | External law, **not read** | — | The KVG analysis list was not part of the Fedlex reading |
| `governance-framework.md` | Practice retention: OR Art. 958f, ten years, where the record falls within the accounting-law obligation | External law, read against Fedlex | Fedlex, 2026-09-13 | Whether a given credential-derived attribute falls within it depends on purpose and record |
| `public-health.md` | Coverage survey: three contact attempts, per-canton operational workflow, what the frame holds at invitation | **Unresolved** | Not covered by the FOPH and EBPI reading | Recorded in source verification |

### Scope of the demonstrator

| File | Statement or mechanism | Classification | Source | Remaining caveat |
| --- | --- | --- | --- | --- |
| `README.md`, `spec-conformance.md` | Nothing here has run against production swiyu | Statement about this repository | Its own history | — |
| `spec-conformance.md` | Under `SWIYU_MODE=mock` there is no signing, no DPoP, no encryption and no DID resolution | DIDAS implementation choice | The bundled mock | Everything attributed to "generic issuer" or "generic verifier" is unexercised in that mode |
| F-04, `beta-id.ts` | The demonstrator uses the Sandbox Beta-ID | DIDAS implementation choice | What is available on the Sandbox today | Migration to the production e-ID will require the final production issuer, `vct` and schema or profile details once available. **No date is asserted and the production credential is not assumed to be a drop-in replacement** |
| `docs/credentials/*.md` | Claims, constraints, bindings and the disclosure matrix | Generated from `packages/swiyu/src/credentials/` | `npm run generate:docs`; CI fails when stale | Generated prose carries the definitions' wording, so a defect in a template or an `issuerBasis` string reaches a reader through it |
| `architecture.md` | No FHIR server and no clinical data repository are operated here | DIDAS implementation choice | A scope choice for this prototype | Not a judgement on either architecture |
| F-01 | Verification falls back to explicitly listed issuer DIDs | DIDAS governance choice | Adequate for a pilot | Inadequate at scale; the missing layer is the health governance body |

## 2 · Profile gaps

| Gap | Capability | Affected flows | Current limitation | Required capability | Likely affected area | Change type | External standards or bridges |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GP-01 | Multi-credential and multi-instance presentation semantics | F-08, F-04 | `multiple` NOT SUPPORTED. The profile does not separate several Credential Queries in one verification from several instances per query | Explicit statement of the three cases, of query-to-credential association, and of complete against partial satisfaction | Swiss Profile Verification | specification | OpenID4VP 1.0, DCQL |
| GP-02 | Provenance of a derived representation | F-07, F-08 | No defined way to carry or retain provenance when a verified presentation becomes FHIR or openEHR | A definition of what is retained, how the derived object references it, and what a downstream system may conclude | Swiss Profile VC; an interoperability profile | specification, implementation | HL7 FHIR R4, CH Core, CH VACD, CH EMED, openEHR, W3C Provenance concepts |
| GP-03 | Holder-originated authorisation object | F-09 | No holder-as-issuer pattern, no lifecycle, no verifier interpretation | The mechanism, its key binding, lifecycle, withdrawal, status, verifier interpretation and governance treatment | Swiss Profile Issuance; Trust Protocol | specification, governance | SD-JWT VC; Human Research Act as the distinct legal layer |
| GP-04 | Standing authorisation and continuous disclosure | F-10 | Each presentation is a discrete, separately approved interaction | Establishment, duration, scope, modification, suspension, withdrawal, holder visibility, and evidence that an exchange stays in scope | Swiss Profile Verification; governance | specification, governance | OAuth 2.0 grant models, capability models; no mechanism preselected |
| GP-05 | Measurement and device provenance | F-10 | No attestation model for the device or software producing a measurement; key attestation concerns key storage | Separation of device identity, producing software, subject attribution, attributing actor and the assurance of each | Swiss Profile Issuance; Trust Protocol | specification | Device attestation frameworks; IEEE and IHE device-data profiles |
| GP-06 | Richer lifecycle and status semantics | F-05, F-06 | The Token Status List carries a status value and no reason | A defined way to obtain a business reason where a use case needs one | Swiss Profile VC; issuer management APIs | specification, implementation | IETF Token Status List Draft 20 |
| GP-07 | Supersession and replacement | F-06 | No lineage between a corrected credential and the one it replaces | Explicit lineage that distinguishes correction, replacement, supersession, revocation and expiry, without adding a stable cross-presentation correlator | Swiss Profile VC | specification | CH VACD `relatesTo` and its merge-conflict model |
| GP-08 | Predicate and derived-attribute presentation | F-03, F-11 | SD-JWT discloses or withholds a claim; no mechanism demonstrates a predicate over a withheld value | A recorded decision on whether Swiss threshold use cases are met by pre-computed issuer claims or require a cryptographic mechanism | Swiss Profile VC and its cryptographic suite | specification | ES256 constrains the candidates; BBS+ and Longfellow ZK are candidates, not decisions |
| GP-09 | Structural unlinkability | F-03, F-11 | Selective disclosure removes claim values and leaves eight other correlation surfaces in place | A correlation model first: which surfaces matter, for which use case, against which adversary | Swiss Profile VC; Swiss Profile Issuance | specification | Batch issuance, pairwise identifiers, key rotation; none prescribed before the model exists |
| GP-10 | Cross-domain and cross-border trust evaluation | F-08 | Trust statements are published and evaluated within the Swiss trust domain; no recognition path across domains | Recognition in both directions, authorisation mapping, federation of governed-use-case semantics, treatment of foreign organisational identifiers | Swiss Profile Trust; Trust Protocol; organisational-identity governance | specification, governance, legal/policy | **LEI (ISO 17442); vLEI within the GLEIF ecosystem governance framework; a Swiss OrgID if and when established; the swiyu organisational DID; Trust Protocol 2.0; sector-specific authorisation** |

### GP-10a · what each part of the bridge answers

| Component | Answers | Does not answer |
| --- | --- | --- |
| swiyu organisational DID | Which actor this is within the Swiss trust infrastructure | Anything outside that infrastructure |
| Swiss organisational identifier | The Swiss legal and administrative context | Global resolution |
| LEI | Which legal entity an organisational identifier refers to, globally | Any authorisation |
| vLEI | Which organisational role or authority has been asserted for a holder, within the vLEI governance framework | Whether that role authorises a given credential type in a given jurisdiction |
| Swiss trust statements | Swiss and domain-specific governance and authorisation | Recognition by a foreign relying party |
| Relying-party policy | Whether the assertions satisfy this transaction | Anything about the other domains' internal validity |

Dual anchoring rather than replacement: a Swiss organisational actor stays
governed by Swiss law and the Swiss trust infrastructure while also carrying a
globally resolvable organisational identity anchor. Global standards, local
governance.

## 3 · How to keep this current

This table is prose and drifts like any other prose. Three checks constrain it:

- `npm run check:flow-types` refuses a `profile_gaps` entry that the register
  does not define, and refuses `profile_status: beyond-current-profile` with no
  gap named.
- `npm run check:articulation` requires that every sentence carrying a watched
  word has been read. It is a review gate and not semantic validation.
- [`spec-conformance.md`](spec-conformance.md) traces each enforced rule to its
  clause, and `packages/swiyu/test/conformance.test.ts` fails the build when the
  code and the recorded rule disagree.

None of the three can tell whether a classification in the first table above is
correct. That remains a reading.

**What the checks do not read.** `check-articulation.mjs` covers
`site/index.html`, `README.md`, `docs/*.md`, `docs/credentials/*.md`,
`flows/*.md` and the LikeC4 model. `docs/credentials/` was added after this
report first found the gap: it is generated from the credential definitions, and
a template string that named a marker as something a counterparty "carries"
reached three credential types through it. Generated prose is still prose.

The checker does not read TypeScript. Building this report found two doc comments in
`governance.ts` that the documentation had moved past: the `statistics` role
said a coverage survey "needs no identifying claim at all because its own
sampling frame already supplies age and canton", which is the claim source
verification records as not covered by the FOPH and EBPI reading and which was
removed from the portal, the roadmap, F-11 and the model; and the `travelClinic`
role said it "asks only whether protection exists", the framing F-03 was renamed
away from. Both are corrected. A grep for the other watched constructions across
`packages/` and `apps/` returned nothing further, which is weaker evidence than
the sentence-level reading the prose gets.
