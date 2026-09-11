# Documentation

Start wherever your question is.

## Why

| | |
| --- | --- |
| [**Business case**](business-case.md) | The problem, what each party gets, what it costs, why 2026, and what this deliberately does not solve. |
| [**Roadmap**](roadmap.md) | Immunization Showcase (2026, delivered) → International Patient Summary (2027) → Swiss Health App (2028). |
| [**Positioning**](positioning.md) | Two showcases at one hackathon: this one and the openEHR clinical data repository. The objection to wallet-held records, stated at full strength, and where the two compose. |

## How it is governed

| | |
| --- | --- |
| [**Governance framework**](governance-framework.md) | Roles, the three gates, trust markers and policies, protected fields, legal bases, retention, lifecycle, the audit journal — and the one layer that is missing. |
| [**Flows** (the blueprint)](../flows/README.md) | Ten documented flows, each with governance constraints, standardisation constraints and open questions. Written to be transferred into a trust flows repository. |

## How it works

| | |
| --- | --- |
| [**Architecture**](architecture.md) | The four layers, what we deliberately do not implement, and the trade-offs taken. |
| [**Integration guide**](integration-guide.md) | For a practice, pharmacy or insurer system: the two APIs you actually call, and the things that will bite you. |
| [**Swiss Profile conformance**](spec-conformance.md) | Every rule this project enforces, mapped to the clause it comes from. |
| [**Source verification**](source-verification.md) | What was checked against a primary source, what rests on a secondary one, and which assertions — the legal citations in particular — are unverified. |

## What the credentials are

| | |
| --- | --- |
| [**Credential reference**](credentials/README.md) | Generated from the definitions: claims, constraints, FHIR and openEHR bindings, terminology, and the full who-may-ask-for-what matrix. |
| [Immunization](credentials/immunization.md) · [Insurance card](credentials/insurance-card.md) · [Prescription](credentials/prescription.md) · [Laboratory report](credentials/lab-report.md) · [Beta-ID](credentials/beta-id.md) | One page per credential type. |

## Running it

| | |
| --- | --- |
| [**Sandbox onboarding**](onboarding-sandbox.md) | Business partner, DIDs, trust onboarding, vqPS, hosting. What only a person can do, and what `scripts/onboard.sh` automates. |
| [**Glossary**](glossary.md) | Swiss administrative, verifiable-credential and clinical-informatics vocabulary in one place. |

## What is generated, and what is argued

`docs/credentials/` is generated from `packages/swiyu/src/credentials/` by
`npm run generate:docs`, and CI fails if it is stale. Documentation that can be
generated from a data structure should be. Hand-written prose about a data
structure drifts out of date silently.

Everything else here is an argument — and an argument that could be generated
from a data structure was not worth making.
