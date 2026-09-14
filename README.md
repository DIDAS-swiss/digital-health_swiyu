# Digital Health on the swiyu Trust Infrastructure

> **Origin and attribution**  
> Developed and contributed by **Accelerate GmbH** and published by DIDAS as an open-source ecosystem contribution.  
> Canonical upstream: https://github.com/Accelerate-GmbH/digital-health-swiyu-vaccination  
> DIDAS publication: https://github.com/DIDAS-swiss/digital-health_swiyu

**[Immunisation showcase portal](https://didas-swiss.github.io/digital-health_swiyu/)**
· [Flow diagrams](https://didas-swiss.github.io/digital-health_swiyu/flows/)

This repository demonstrates how verifiable digital health credentials can be
issued, held, presented and verified using the Swiss swiyu Trust Infrastructure.

The implementation builds on the Digital Health use case developed through the
Swiss GovTech Hackathons and demonstrates an end-to-end patient journey using the
swiyu Sandbox and the applicable Swiss Profiles.

The current showcase focuses on immunisation records. Vaccination credentials can
be issued to a patient wallet and subsequently presented to an authorised
healthcare provider, including through selective disclosure where supported by
the credential design and protocol.

The implementation also explores additional digital-health credential types,
including patient identification, insurance information, laboratory reports and
prescriptions.

The objective is not to replace established healthcare information standards such
as HL7 FHIR or openEHR. Instead, the project explores how established healthcare
semantics can be combined with verifiable credentials and the swiyu Trust
Infrastructure. The properties this adds are specific: a signature over the
issued claims that a verifier can check, selective disclosure at claim level,
status resolution that does not require contacting the issuer, and a policy
layer that decides which role may issue a credential type and which claims a
role may request.

## Purpose

The repository addresses three complementary layers:

- **Interoperability** — implementation against the applicable swiyu profiles and
  the relevant OpenID and SD-JWT standards.
- **Healthcare semantics** — mapping credential content to established healthcare
  information models such as FHIR and openEHR where appropriate.
- **Governance** — definition of the rules and trust relationships governing who
  may issue, request, present and verify particular credentials and attributes.

The result is a practical reference implementation for exploring how
Switzerland's digital trust infrastructure can support interoperable
digital-health use cases.

## What this repository demonstrates

The material in this repository falls into four categories, which are kept
distinct throughout the documentation.

| Category | Meaning | Where |
| --- | --- | --- |
| **Implemented** | Running code in this repository, exercised by the test suite and the demonstration application | F-02, F-03, F-04, F-05, F-07 |
| **Demonstrated against current swiyu specifications** | Rules of the Swiss Profiles and Trust Protocol 2.0 that the code enforces, each mapped to the specification section that states it | [`docs/spec-conformance.md`](docs/spec-conformance.md) |
| **Beyond the current specification** | Behaviour this project models but the current profiles do not define, or that depends on an ecosystem role that does not yet exist | F-01, F-06; see [Current implementation scope and limitations](#current-implementation-scope-and-limitations) |
| **Roadmap or conceptual** | Specified as documented flows, not built | F-08, F-09, F-10, F-11; see [`docs/roadmap.md`](docs/roadmap.md) |

Nothing in this repository has been executed against a production deployment of
the swiyu Trust Infrastructure. See
[Current implementation scope and limitations](#current-implementation-scope-and-limitations).

## Digital health use case and patient journey

The showcase follows a patient through a course of care. A vaccination is
administered and the vaccinator issues one credential per dose to the patient's
wallet. The patient later presents evidence of protection to a travel clinic,
releasing four of the eighteen claims the immunisation credential carries. Around
that sit the other steps of a consultation: check-in against an identity
credential and an insurance credential, a laboratory report, and a prescription
redeemed once at a pharmacy.

| Credential | Issuer | Status in this repository |
| --- | --- | --- |
| Beta-ID — the swiyu Sandbox stand-in for the e-ID | Beta Credential Service (Confederation) | Verified, never issued here |
| Insurance information | Health insurer | Implemented |
| Immunisation record, one per dose | The authorised vaccinator that administered the dose | Implemented |
| Laboratory report | Laboratory, or the treating practice on its behalf | Implemented |
| Prescription | The prescribing practitioner | Implemented |
| Coverage-survey invitation, single use | Epidemiology, Biostatistics and Prevention Institute (EBPI), University of Zurich | Roadmap, specified in [F-11](flows/F-11-coverage-survey.md) |

The coverage-survey invitation is documented but not built. In the modelled
design the Swiss National Vaccination Coverage Survey posts an invitation to a
sampled household; the QR code in that letter delivers a single-use credential
carrying the sampling stratum and no household identifier, and the credential is
revoked once the response has been accepted.

### The showcase portal

The portal is published at
**<https://didas-swiss.github.io/digital-health_swiyu/>** and its source is
[`site/index.html`](site/index.html). It walks through issuance, minimal
disclosure at the travel clinic, the governance gates, the FHIR and openEHR
projections and the roadmap. It is published by the `portal` workflow on every
push to `main` that touches it, and is committed to the repository so that its
prose can be reviewed alongside the credential definitions and flows it
describes.

The page can be opened locally with `open site/index.html`; it has no build step
and no runtime dependencies. The interactive flow diagrams are built from
[`flows/likec4/`](flows/likec4/README.md) and published under
[`/flows/`](https://didas-swiss.github.io/digital-health_swiyu/flows/). Seven of
the eleven documented flows are modelled as diagrams, each linked from its row on
the showcase.

## Architecture

Credentials are issued to, and held in, the patient's wallet. A relying party
receives credential content when the holder presents it, and verifies it against
the issuer's signature and the swiyu Trust Infrastructure.

The swiyu Trust Infrastructure provides shared components that this design
depends on, including the Base Registry, which resolves issuer and verifier
identifiers and hosts status information, and the Trust Registry, which carries
trust statements about participants. These are central components of the
ecosystem and this project relies on them.

The narrower architectural property this design has is this: **the exchange
model does not require a central repository containing the clinical payloads
exchanged through these credentials.** It makes no claim about the absence of
registries or central components generally.

### An architectural consideration from meineimpfungen.ch

The closure of meineimpfungen.ch illustrates the availability and continuity
risks associated with relying on a single service for access to longitudinal
health information. This project explores an alternative exchange model in which
verifiable credentials can be issued to patients and subsequently presented to
authorised relying parties without requiring the same healthcare payload to be
stored in a central credential-exchange repository. A credential already issued
remains usable by its holder if the issuing organisation ceases to operate,
subject to the status and revocation mechanisms described below.

This model does not eliminate central infrastructure, governance dependencies or
security risks. It depends on the federal registries named above, on wallet
availability and recovery, on key management and on the governance arrangements
described in the next section. It changes where the healthcare payload resides
and who controls its release; it does not remove the need for operational
security or institutional trust.

## Governance

The technical profile establishes whether a message is well formed and correctly
signed. It does not establish who may assert a clinical fact, who may request
one, or whether a given presentation should be accepted. Those questions are
implemented in
[`packages/swiyu/src/governance.ts`](packages/swiyu/src/governance.ts) and
evaluated within the flows. The full model is documented in the
[governance framework](docs/governance-framework.md).

- **Issuance authorisation.** `reviewIssuance()` evaluates whether an actor may
  issue a given credential type before a request reaches the issuer. A practice
  may issue an immunisation credential because it holds the vaccinator role in
  this project's policy configuration; an insurer does not hold that role.
- **Request entitlement.** Each credential type declares per-role entitlements.
  A request for a claim outside the requesting role's entitlement is rejected
  while the DCQL query is being constructed, before it reaches the holder. A
  check applied after the wallet has responded would operate on claims the
  verifier already holds, so it would constrain the verifier's later use of them
  rather than which claims it received.
- **Protected fields.** Under `swiss-profile-trust:1.0`,
  `personal_administrative_number`, the AHV number, requires an explicit
  authorisation before a verifier may request it, whichever credential type
  carries it. In this project the practice holds that authorisation because Swiss
  billing uses the number, and no other role does.
- **Trust markers.** Presentations are evaluated against a configured policy.
  MUST-level rules of the Trust Protocol are enforced under every policy;
  SHOULD-level rules are waived under the Sandbox policy and recorded as waived.
- **Audit journal.** Every decision is recorded with its reasons. The journal
  records claim *names* only; a test asserts that no claim value reaches it.

### Legal framing

The Federal Act on Electronic Proof of Identity of 20 December 2024 (E-ID-Gesetz,
BGEID) governs the federal trust infrastructure and the EID. It does not govern
the content of a health credential, and it does not determine what a practice or
a pharmacy may request. Article 23 establishes a proportionality requirement on
verifiers for the EID specifically; there is no equivalent statutory test for the
other credentials modelled here. See
[`docs/governance-framework.md`](docs/governance-framework.md#what-the-e-id-act-does-and-does-not-decide).

A governance body for the health domain, able to grant and withdraw the role
entitlements this model depends on, does not currently exist. This is the most
significant open dependency in the design and is documented as such.

## Healthcare interoperability

HL7 FHIR and openEHR address healthcare semantics, information models and
clinical data exchange and persistence. Verifiable credentials and the swiyu
Trust Infrastructure address authenticity, provenance, controlled presentation
and trust relationships. These are different layers and they can be composed.

This project reuses the information models and does not itself operate a
clinical data repository. That is a property of this demonstrator, not a
statement about how FHIR or openEHR should be deployed: FHIR is an exchange
and information-model specification rather than a repository architecture, and
an openEHR deployment's persistence model is a separate design decision.

Every claim of every credential type carries the FHIR element path and, where one
exists, the openEHR archetype path it corresponds to. At presentation time a
receiving system can rebuild the representation it already understands, locally,
from the claims the holder released. Two properties hold for every such
projection and are stated in the code at the point where it performs one:

- a projection is **derived and not authoritative** — the signed credential is
  the evidence;
- a projection is **legitimately partial** — after selective disclosure, an
  absent element is an expected outcome of the disclosure rather than a data
  error.

The mappings in this repository are the project's own and have not been reviewed
or endorsed by the standards bodies concerned. They are intended to demonstrate
that verifiable credentials can complement established healthcare semantics —
adding holder-controlled exchange, cryptographic authenticity, selective
disclosure and governance — rather than to constitute a conformant FHIR or
openEHR implementation. See [`flows/F-07`](flows/F-07-model-projection.md) and
[`docs/positioning.md`](docs/positioning.md).

## Implemented credential flows

[`flows/`](flows/README.md) contains eleven documented flows. Each carries
machine-readable front matter, a sequence diagram, its governance constraints,
its standardisation constraints and its open questions. Each file is
self-contained, so that a flow can be transferred to a trust-flow repository
independently of the rest of this repository.

| Flow | Subject | Status |
| --- | --- | --- |
| [F-01](flows/F-01-actor-onboarding.md) | Actor onboarding: identifier publication, identity verification, role grant, verification query publication | Partial |
| [F-02](flows/F-02-immunization-issuance.md) | Issuance of an immunisation record | Implemented |
| [F-03](flows/F-03-immunization-minimal-disclosure.md) | Presentation of protection evidence with minimal disclosure | Implemented |
| [F-04](flows/F-04-practice-check-in.md) | Check-in at a practice against identity and insurance credentials | Implemented |
| [F-05](flows/F-05-prescription-redemption.md) | Single-use prescription redemption at a pharmacy | Implemented |
| [F-06](flows/F-06-lifecycle-and-correction.md) | Revocation, correction and supersession | Partial |
| [F-07](flows/F-07-model-projection.md) | Projection of released claims into FHIR and openEHR representations | Implemented |
| [F-08](flows/F-08-patient-summary.md) | Patient summary | Roadmap |
| [F-09](flows/F-09-secondary-use.md) | Secondary use of health data | Roadmap |
| [F-10](flows/F-10-continuous-data.md) | Continuous data | Roadmap |
| [F-11](flows/F-11-coverage-survey.md) | National vaccination coverage survey | Roadmap |

## Relationship to swiyu

The implementation is pinned to the Swiss Profiles version 1.0 as published for
the swiyu Sandbox, and to Trust Protocol 2.0. It uses the swiyu generic issuer
and generic verifier components rather than reimplementing the protocols, and it
follows the swiyu onboarding process for each actor.

Where this project goes beyond what the current specifications define, it says
so:

- **Role entitlement.** The model requires an authorisation stating that a given
  issuer may issue a specific health credential type. In Trust Protocol 2.0 terms
  this corresponds to a Governed Use Case Authorization Trust Marker. No
  health-domain governing authority exists to issue such a marker, so
  verification currently relies on explicitly configured accepted issuer
  identifiers. This is adequate for a pilot and does not scale.
- **Holder notification on correction.** F-06 models a notification to the holder
  when a credential is superseded. The current profiles define no mechanism for
  it.

This repository is an independent implementation. It is not an official
deliverable of the swiyu programme, the Confederation or any federal office.

## Current implementation scope and limitations

These limitations are material to any assessment of the work and are stated
rather than implied.

- **Not production-ready.** This is a reference implementation for exploration
  and discussion. It has not undergone a security review, a data protection
  impact assessment or operational hardening.
- **The bundled mock is not a protocol test.** The default `SWIYU_MODE=mock`
  runs the journey offline against a bundled mock of the swiyu generic
  components, including a simulated wallet. The mock performs **no signing, no
  DPoP, no encryption and no identifier resolution**. It exercises the business
  flow and the governance rules and establishes nothing about protocol
  conformance. The demonstration interface says so where it applies, and the
  showcase portal carries the same scope note.
- **Sandbox only.** Nothing here has been run against a production deployment.
  Conformance rules are enforced against the profile text; the issuance and
  verification paths have not been exercised end to end against the live
  Sandbox.
- **Selective disclosure.** The Swiss Profile mandates the SD-JWT VC format, in
  which claims are individually disclosable. Predicate proofs, meaning a
  demonstration that a claim satisfies a condition without disclosing the claim
  value, are not available in this profile. Where an age threshold is used it is
  a separate claim carried by the credential, computed by the issuer, rather than
  a proof computed over a withheld date of birth.
- **Unlinkability is not claimed.** Selective disclosure narrows the claims
  included in a presentation to a given verifier. It does not remove the
  correlation surfaces available across presentations, which include the
  credential identifier, the holder key, the disclosed claim values, the
  status-list reference, timing and network metadata.
- **Semantic mappings are unreviewed.** See
  [Healthcare interoperability](#healthcare-interoperability).
- **Demonstration data is illustrative.** SNOMED CT codes, GLNs, BAG numbers,
  GTINs and LOINC codes in the demonstration data are plausible and not real. A
  deployment must take them from the appropriate terminology service.
- **Legal citations require review.** Statements about the legal basis on which
  each issuer acts are the project's own reading and should be reviewed by
  qualified counsel before reuse. They are itemised in
  [`docs/source-verification.md`](docs/source-verification.md).

## Roadmap and future work

Flows F-08 to F-11 are specified and not built: patient summary, secondary use,
continuous data and the national vaccination coverage survey. The roadmap,
including the sequencing and the dependencies each item carries, is in
[`docs/roadmap.md`](docs/roadmap.md). The public-health perspective on the
coverage survey is in [`docs/public-health.md`](docs/public-health.md).

## Technical setup

### Prerequisites

Node.js 20.10 or later.

### Running the demonstration

```bash
npm install
npm run verify        # typecheck, 103 tests, diagram checks
npm run dev           # http://localhost:3000
```

The default mode is `SWIYU_MODE=mock`, described under
[Current implementation scope and limitations](#current-implementation-scope-and-limitations).

To run the same application code against the swiyu Sandbox, follow
[`docs/onboarding-sandbox.md`](docs/onboarding-sandbox.md): onboard each actor,
generate the configuration, start the generic components and set
`SWIYU_MODE=sandbox`. No application code changes are required.

### Generating credential configuration

A credential type requires four artefacts that must remain consistent: the
OID4VCI configuration entry, the SD-JWT VC Type Metadata, a JSON Schema and an
OCA bundle for wallet rendering. In this repository one TypeScript definition
generates all four, computes the CESR self-addressing digests the OCA bundle
requires and the SRI hashes that bind the documents together. The generator
refuses to emit output that the Swiss Profile would reject.

```bash
npm run generate:config -- --praxis-url https://praxis.example.ch
```

The external URL is fixed at generation time deliberately: the issuer metadata
carries an SRI hash over the exact bytes of the Type Metadata document, so a
templated URL substituted at serve time would hash a document that is never
served. If the URL changes, regenerate.

### Browser bundle

```bash
npm run build:browser
```

This bundles the decision logic — the governance engine, the DCQL builder, the
conformance checks and the projections — into a single script that runs in a
page. Only the generators require Node, because they compute CESR and SRI digests
over files on disk. The arrangement exists so that the walkthrough exercises the
same rules the library enforces, rather than a second implementation written for
the demonstration.

### Repository layout

| Path | Contents |
| --- | --- |
| [`docs/`](docs/README.md) | Business case, governance framework, architecture, integration guide, conformance mapping, onboarding runbook, positioning, source verification, glossary |
| [`docs/credentials/`](docs/credentials/README.md) | **Generated.** One page per credential type, and the per-role disclosure matrix |
| [`flows/`](flows/README.md) | Eleven documented flows, transferable |
| `packages/swiyu/` | Swiss Profile constants, management API clients, DCQL builder, credential definitions, conformance checks, governance engine, FHIR and openEHR projections |
| `apps/demo/` | The four actors, the patient journey interface and the offline mock |
| `config/` | **Generated.** Issuer metadata, Type Metadata, JSON Schemas, OCA bundles |
| `scripts/` | `generate-config.ts`, `generate-docs.ts`, `vqps.ts`, `onboard.sh` |

### Where to start

| Audience | Suggested entry point |
| --- | --- |
| Assessing the case for the work | [Business case](docs/business-case.md), then the [roadmap](docs/roadmap.md) |
| Reviewing the governance model | [Governance framework](docs/governance-framework.md) and the [disclosure matrix](docs/credentials/README.md) |
| Integrating a practice or pharmacy system | [Integration guide](docs/integration-guide.md) |
| Deploying against the Sandbox | [Onboarding runbook](docs/onboarding-sandbox.md) |
| Reusing the flows elsewhere | [`flows/`](flows/README.md) |
| Terminology | [Glossary](docs/glossary.md) |

## Standards and conformance

Pinned to Swiss Profiles 1.0 as published for the swiyu Sandbox:

| Profile | Covers |
| --- | --- |
| `swiss-profile-anchor:1.0.0` | DID Core 1.0, `did:webvh` 1.0 |
| `swiss-profile-issuance:1.0.0` | OpenID4VCI 1.0, OAuth 2.0 DPoP (RFC 9449) |
| `swiss-profile-verification:1.0.0` | OpenID4VP 1.0, JAR (RFC 9101) |
| `swiss-profile-vc:1.0.0` | SD-JWT (RFC 9901), SD-JWT VC Draft 15, Token Status List Draft 20, OCA 1.0 |
| `swiss-profile-trust:1.0` | Trust Protocol 2.0: trust markers, protected fields, Trust Registry |

[`docs/spec-conformance.md`](docs/spec-conformance.md) maps each rule this
project enforces to the specification section that states it.
[`docs/source-verification.md`](docs/source-verification.md) records which
statements in this repository were checked against a primary source, which rest
on secondary sources and which remain unverified.

## Origins and contributors

This showcase was prompted by two Swiss GovTech Hackathons, each of which
contributed part of the basis it builds on.

| Use case | Contribution |
| --- | --- |
| [GovTech Hackathon 2024, project 1103](https://hack.opendata.ch/project/1103), "Digital Health mit der neuen E-ID Trust-Infrastruktur" | Led by DIDAS, with Peter Janes as project lead. Established the use case, the stakeholder model and the staged EPD 1.0 / 2.0 / 3.0 framing this repository continues. Awarded in the future-oriented category. |
| [GovTech Hackathon 2026, project 28](https://govtech.digisus-lab.ch/project/28), "Showcase Impf-Modul" | Brought by openEHR Switzerland with a DIDAS contribution. Supplied the clinical model perspective: CH VACD profiling, terminology binding and openEHR persistence. This project reuses that work without adopting a central repository. See [`docs/positioning.md`](docs/positioning.md). |

The original implementation in this repository was developed and contributed by
[Accelerate GmbH](https://www.accelerate.swiss/).

## Licence

Software is licensed under the MIT License; see [LICENSE](LICENSE). Documentation, flow specifications, diagrams, governance material and other original repository content are licensed under Creative Commons Attribution 4.0 International; see [LICENSE-CONTENT](LICENSE-CONTENT). Third-party materials remain subject to their respective terms; see [NOTICE.md](NOTICE.md).
