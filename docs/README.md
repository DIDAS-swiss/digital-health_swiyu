# Documentation

Start wherever your question is.

## Why

| | |
| --- | --- |
| [**Business case**](business-case.md) | The problem, what each party gets, what it costs, why 2026 and what this deliberately does not solve. |
| [**Roadmap**](roadmap.md) | Immunization Showcase (2026, delivered) → International Patient Summary (2027) → Swiss Health App (2028). |
| [**The public health view**](public-health.md) | What a population-health reader should take from this: coverage measurement survives, targeting individuals does not and equity is the question the design has not answered. |
| [**Positioning**](positioning.md) | Two showcases at one hackathon: this one and the openEHR clinical data repository. The objection to wallet-held records, stated at full strength and where the two compose. |

## How it is governed

| | |
| --- | --- |
| [**Governance framework**](governance-framework.md) | Roles, the three gates, trust markers and policies, protected fields, legal bases, retention, lifecycle, the audit journal and the one layer that is missing. |
| [**Flows** (the blueprint)](../flows/README.md) | Eleven documented flows, each with governance constraints, standardisation constraints and open questions. Written to be transferred into a trust flows repository. |

## How it works

| | |
| --- | --- |
| [**Architecture**](architecture.md) | The four layers, what we deliberately do not implement and the trade-offs taken. |
| [**Integration guide**](integration-guide.md) | For a practice, pharmacy or insurer system: the two management APIs to call, and the constraints most likely to cause problems in practice. |
| [**Swiss Profile conformance**](spec-conformance.md) | The rules this project enforces, each mapped to the clause it comes from, with project policy labelled separately. |
| [**eHealth Suisse alignment**](ehealth-suisse-alignment.md) | The Swiss identifiers, exchange formats and CH VACD mechanisms this project reuses, the three it repurposes for its own open questions and where it diverges. |
| [**Swiss Profile gaps**](swiss-profile-gaps.md) | Capabilities this demonstrator requires that Swiss Profiles 1.0 and Trust Protocol 2.0 do not define, GP-01 to GP-10, each referenced from the flows that need it. GP-10 covers cross-border trust evaluation and the LEI/vLEI organisational bridge. |

## What the credentials are

| | |
| --- | --- |
| [**Credential reference**](credentials/README.md) | Generated from the definitions: claims, constraints, FHIR and openEHR bindings, terminology and the full who-may-ask-for-what matrix. |
| [Immunization](credentials/immunization.md) · [Insurance card](credentials/insurance-card.md) · [Prescription](credentials/prescription.md) · [Laboratory report](credentials/lab-report.md) · [Beta-ID](credentials/beta-id.md) | One page per credential type. |

## Running it

| | |
| --- | --- |
| [**Sandbox onboarding**](onboarding-sandbox.md) | Business partner, DIDs, trust onboarding, vqPS, hosting. What only a person can do and what `scripts/onboard.sh` automates. |
| [**Glossary**](glossary.md) | Swiss administrative, verifiable-credential and clinical-informatics vocabulary in one place. |

## Review and sources

| | |
| --- | --- |
| [**Review status**](review-report.md) | What comes from the current Swiss Profiles, what is a project choice, and what remains unresolved or beyond the current profiles. |
| [**Source verification**](source-verification.md) | Primary and secondary sources used for factual claims, plus assertions that remain unverified. |
| [**Writing standard**](writing-standard.md) | Editorial rules for actor, mechanism, scope and evidentiary precision. |

## What is generated and what is argued

`docs/credentials/` is generated from `packages/swiyu/src/credentials/` by
`npm run generate:docs` and CI fails if it is stale. Documentation that can be
generated from a data structure should be. Hand-written prose about a data
structure drifts out of date silently.

The remaining documents are analysis rather than reference: they set out
reasoning, trade-offs and open questions, and are maintained by hand.
