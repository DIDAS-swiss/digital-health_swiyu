# digital-health_swiyu

**📍 [Immunization Showcase — the portal](https://didas-swiss.github.io/digital-health_swiyu/)**
· [Flow diagrams](https://didas-swiss.github.io/digital-health_swiyu/flows/)

Digital health on the **swiyu** Swiss trust infrastructure — the ecosystem
behind the Swiss e-ID. An end-to-end, runnable implementation of
[GovTech Hackathon project 1103](https://hack.opendata.ch/project/1103),
"Digital Health mit der neuen E-ID Trust-Infrastruktur", built against the
**swiyu Sandbox** and **Swiss Profiles version 1.0**.

The showcase is an **immunization record**. A vaccination is administered, the
vaccinator issues one credential per dose into the patient's wallet, and the
patient later proves protection to a travel clinic while disclosing four claims
out of the eighteen the credential holds. Around it sits the rest of a
consultation: check-in against an e-ID and an insurance card, a laboratory
report, and a prescription redeemed once at a pharmacy.

```
patient wallet ──┬── Beta-ID (e-ID from 2026)         issued by the Confederation
                 ├── insurance card                   issued by the insurer
                 ├── immunization × n                 issued by whoever vaccinated
                 ├── laboratory report                issued by the practice
                 ├── prescription                     issued by the prescriber
                 └── survey invitation, single use    issued by EBPI   [roadmap]
```

The first five are issued and verified by the code in this repository. The sixth
is specified in [F-11](flows/F-11-coverage-survey.md) and not built: the Swiss
National Vaccination Coverage Survey posts an invitation to a sampled household,
the QR in that letter delivers a single-use credential carrying the sampling
stratum and no household identifier, and it is revoked once the response is
accepted.

No registry sits in the middle of any of it.

## The portal

The portal is published at
**<https://didas-swiss.github.io/digital-health_swiyu/>**.
[`site/index.html`](site/index.html) is its source: a single page
that walks the full journey — issuance, minimal disclosure at the travel clinic,
the governance gates, the FHIR and openEHR projections, and the roadmap. It is
published by the `portal` workflow on every push to `main` that touches it, and
it is checked in so the prose versions alongside the credential definitions and
the flows it describes.

Open it locally with `open site/index.html`; it has no build step and no runtime
dependencies. The interactive flow diagrams are built alongside it from
[`flows/likec4/`](flows/likec4/README.md) and published under
[`/flows/`](https://didas-swiss.github.io/digital-health_swiyu/flows/). Each of
the seven modelled flows is linked from its row on the showcase.

## Why the record lives in the wallet

Switzerland has run the centralised version. `meineimpfungen.ch` held the
national electronic vaccination record until it was shut down in 2021 after
serious security failures, and several hundred thousand people lost access to
their own vaccination history at once. The platform was badly built, and that
explanation is accurate as far as it goes. There is a second, structural point: a
design in which one database holds everyone's record carries a failure mode that
careful engineering does not remove, because the database can be breached,
defunded or switched off, and each of those removes access for every person at
the same moment.

Here the record is a set of credentials in the patient's wallet. It survives its
issuers: a practice that closes, a platform that is wound up, a decision to
switch a registry off.

## Reusing the models without the repository

openEHR and HL7 FHIR are usually adopted as a package: shared information models
*and* a shared repository that some organisation operates. This project adopts
the information models and does not adopt the repository.

Every claim of every credential type carries the FHIR element path and, where
one exists, the openEHR archetype path it corresponds to. At presentation time a
receiving system rebuilds the representation it already understands. That
happens locally, from what the holder released, with no clinical data repository
and no FHIR server on either side. Two consequences hold for every projection,
and the code states them at the point where it performs one: a projection is
**derived and not authoritative** (the signed credential is the evidence), and a
projection is **legitimately partial** (after selective disclosure, a missing
element is a valid outcome rather than an error).

See [`flows/F-07`](flows/F-07-model-projection.md).

## Governance as well as protocol

The technical profile answers whether a message is well formed and correctly
signed. It does not answer who may assert a clinical fact, who may ask for one,
and whether a given presentation should be accepted. Those questions are
implemented in
[`packages/swiyu/src/governance.ts`](packages/swiyu/src/governance.ts) and run
inside the flow:

- **Who may issue.** `reviewIssuance()` refuses before a request reaches the
  issuer. A practice may issue an immunization because it holds the vaccinator
  role; an insurer may not.
- **Who may ask, and for what.** Each credential type declares per-role
  entitlements. A pharmacy asking for the AHV number is refused when the query is
  *built* — enforcing minimisation after the wallet has answered is too late.
- **Protected fields.** `personal_administrative_number` needs an explicit
  authorization marker under `swiss-profile-trust:1.0`, whatever credential
  carries it. The practice holds that entitlement because it bills with the
  number; nobody else in this project does.
- **Trust markers.** Presentations are evaluated against a policy. The MUST
  rules (a governed use case without authorization is always refused) are
  enforced under every policy; the SHOULDs are waived under the Sandbox policy
  and **recorded as waived**.
- **The journal.** Every decision is recorded with its reasons — and with claim
  *names* only. A test asserts that no claim value ever reaches it.

## The blueprint

[`flows/`](flows/README.md) is the blueprint deliverable: eleven flows, each with
machine-readable front matter, a sequence diagram, its governance constraints,
its standardisation constraints, and its open questions. Each file stands alone,
so that a flow can be **transferred into a trust flows repository** without the
rest of this repository.

Flows F-08 to F-11 are marked `roadmap`: they are specified and not built. See
[`docs/roadmap.md`](docs/roadmap.md).

## Running it in a browser

`npm run build:browser` bundles the decision code — the governance engine, the
DCQL builder, the conformance checks and the projections — into a single script
that runs in a page. Only the *generators* need Node, because they compute CESR
and SRI digests over files on disk. The reason for this arrangement is that the
walkthrough exercises the same rules the library enforces, rather than a second
implementation of them written for the demonstration.

## Running it

```bash
npm install
npm run verify        # typecheck + 97 tests
npm run dev           # http://localhost:3000
```

The default `SWIYU_MODE=mock` runs the whole journey offline against a bundled
mock of the swiyu generic components, including a simulated wallet. **The mock
performs no signing, no DPoP, no encryption and no DID resolution** — it
exercises the business flow and the governance rules, and proves nothing about
protocol conformance. It says so on the page.

To run the same code against the real Sandbox, see
[`docs/onboarding-sandbox.md`](docs/onboarding-sandbox.md): onboard each actor,
generate the configuration, start the generic components, set
`SWIYU_MODE=sandbox`. No application code changes.

## Layout

| Path | What it is |
| --- | --- |
| [`docs/`](docs/README.md) | Business case, governance framework, architecture, integration guide, conformance mapping, onboarding runbook, glossary. |
| [`docs/credentials/`](docs/credentials/README.md) | **Generated.** One page per credential type, plus the who-may-ask-for-what matrix. |
| [`flows/`](flows/README.md) | The blueprint. Eleven documented flows, transferable. |
| `packages/swiyu/` | Swiss Profile constants, management API clients, DCQL builder, credential definitions, conformance checks, governance engine, FHIR/openEHR projections. |
| `apps/demo/` | The four actors, the patient journey UI, and the offline mock. |
| `config/` | **Generated.** Issuer metadata, VCT metadata, JSON Schemas, OCA bundles. |
| `scripts/` | `generate-config.ts`, `generate-docs.ts`, `vqps.ts`, `onboard.sh`. |

## One source of truth per credential type

A credential type needs four artefacts that must agree: the OID4VCI
configuration entry, the SD-JWT VC Type Metadata, a JSON Schema, and an OCA
bundle for the wallet's rendering. Maintaining four documents by hand is how they
drift. Here one TypeScript definition generates all four, computes the CESR
self-addressing digests the OCA bundle needs and the SRI hashes that bind the
documents together. The generator refuses to emit anything the Swiss Profile
would reject.

```bash
npm run generate:config -- --praxis-url https://praxis.example.ch
```

The external URL is baked in at generation time on purpose: the issuer metadata
carries an SRI hash over the exact bytes of the Type Metadata document, so a
templated URL substituted at serve time would hash a document that is never
served. Change the URL, regenerate.

## Specifications

Pinned to Swiss Profiles 1.0 as published for the swiyu Sandbox:

| Profile | Covers |
| --- | --- |
| `swiss-profile-anchor:1.0.0` | DID Core 1.0, `did:webvh` 1.0 |
| `swiss-profile-issuance:1.0.0` | OpenID4VCI 1.0, OAuth 2.0 DPoP (RFC 9449) |
| `swiss-profile-verification:1.0.0` | OpenID4VP 1.0, JAR (RFC 9101) |
| `swiss-profile-vc:1.0.0` | SD-JWT (RFC 9901), SD-JWT VC draft-15, Token Status List draft-20, OCA 1.0 |
| Trust Protocol 2.0 | Trust markers, trust registry |

[`docs/spec-conformance.md`](docs/spec-conformance.md) maps each rule this
project enforces to the section it comes from.

## Where to start

| You are | Read |
| --- | --- |
| Deciding whether this is worth doing | [Business case](docs/business-case.md), then the [roadmap](docs/roadmap.md) |
| Reviewing the governance model | [Governance framework](docs/governance-framework.md) and the [disclosure matrix](docs/credentials/README.md) |
| Integrating a practice or pharmacy system | [Integration guide](docs/integration-guide.md) |
| Standing it up on the Sandbox | [Onboarding runbook](docs/onboarding-sandbox.md) |
| Reusing the flows in another project | [`flows/`](flows/README.md) |
| Lost in the vocabulary | [Glossary](docs/glossary.md) |

## Origins and credits

This showcase was prompted by two GovTech Hackathons, and both supplied part of
the basis it builds on.

| Use case | What it contributed |
| --- | --- |
| [GovTech Hackathon 2024, project 1103](https://hack.opendata.ch/project/1103) — "Digital Health mit der neuen E-ID Trust-Infrastruktur" | Led by DIDAS, with Peter Janes as project lead. It established the use case, the stakeholder model and the staged EPD 1.0 / 2.0 / 3.0 framing this repository continues, and won the future-oriented category that year. |
| [GovTech Hackathon 2026, project 28](https://govtech.digisus-lab.ch/project/28) — "Showcase Impf-Modul" | Brought by openEHR Switzerland with a DIDAS contribution. It supplied the clinical model side — CH VACD profiling, terminology binding and openEHR persistence — which this project reuses without adopting the central repository. See [`docs/positioning.md`](docs/positioning.md). |

The implementation in this repository was written and contributed by
[accelerate.swiss](https://www.accelerate.swiss/), through the GitHub account
[`danielsaeuberli`](https://github.com/danielsaeuberli). The `daniel-didas`
account appears in the contributor list in an administrative capacity and did
not author the code.

## Licence

MIT. See [LICENSE](LICENSE).
