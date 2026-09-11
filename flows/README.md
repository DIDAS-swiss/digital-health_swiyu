# Flow blueprint

This directory is the **blueprint** deliverable of roadmap step 1: the flows of
the use case written down so they can be reviewed, argued with, and moved
somewhere else. They are kept separate from the code and from `docs/` on
purpose — they are meant to be **transferred into a trust flows repository**,
where they will sit next to flows from other sectors that have nothing to do
with this codebase.

The reference model they build on is the [Trust Flow Diagram
Repository](https://github.com/DIDAS-swiss/Trust-Flow-Diagram-Repository), whose
`basic-flow/` covers registration, issuance and verification for the Swiss e-ID
trust infrastructure. Its convention is that domain flows abstract those steps
and point back to it, and these flows follow it.
[`trust-flow-basis.md`](trust-flow-basis.md) records the mapping step by step:
which of our steps are the reference flow under another name, which are
health-specific additions, and the three the reference model has no shape for,
each raised there as an issue.

That intent shapes the format:

- **One file per flow, self-contained.** A flow can be copied out on its own
  without dragging half a repository behind it. Cross-references between flows
  use flow ids, never file paths.
- **Machine-readable front matter, human-readable body.** The YAML block is
  what a registry can index: actors, credential types, protocols, trust markers,
  status. The prose is what a person needs in order to disagree with it.
- **Governance and standardisation constraints are first-class sections**, not
  footnotes. A flow that documents only the message exchange is the easy half.
  The half that decides whether a flow can be deployed is who is allowed to
  play each role, what they may ask for, what they must keep, and which parts of
  the standards stack are fixed: the Swiss Profile settles the format, the
  algorithms and the flows, and a use case chooses only what it asks for.
- **Open questions are recorded.** Where this project
  had to decide something that the ecosystem has not decided, the decision is
  marked as ours.

## Reading the front matter

| Field | Meaning |
| --- | --- |
| `id` | Stable identifier. Referenced from other flows and from code comments. |
| `status` | `implemented` — runnable in this repository. `partial` — the happy path is implemented, named gaps are not. `roadmap` — specified here, deliberately not built. |
| `roadmap_step` | 1 = Immunization Showcase (2026), 2 = International Patient Summary (2027), 3 = Swiss Health App (2028). |
| `actors` | Roles. An organisation may hold several. |
| `credentials` | `vct` values the flow issues or consumes. |
| `protocols` | Wire protocols, pinned to the Swiss Profile version. |
| `trust_markers` | Trust Protocol 2.0 markers the flow depends on. |
| `preconditions` | Flows or states that must already hold. |
| `basis` | The `basic-flow` view in the Trust Flow Diagram Repository this flow builds on. |

## Status of the set

| Flow | Title | Status | Step |
| --- | --- | --- | --- |
| [F-01](F-01-actor-onboarding.md) | Becoming an actor | `partial` | 1 |
| [F-02](F-02-immunization-issuance.md) | Recording an administered dose | `implemented` | 1 |
| [F-03](F-03-immunization-minimal-disclosure.md) | Proving protection, and nothing else | `implemented` | 1 |
| [F-04](F-04-practice-check-in.md) | Check-in at the practice | `implemented` | 1 |
| [F-05](F-05-prescription-redemption.md) | Prescription and its redemption | `implemented` | 1 |
| [F-06](F-06-lifecycle-and-correction.md) | Correction, suspension and revocation | `partial` | 1 |
| [F-07](F-07-model-projection.md) | Projecting into FHIR and openEHR | `implemented` | 1 |
| [F-08](F-08-patient-summary.md) | Assembling an International Patient Summary | `roadmap` | 2 |
| [F-09](F-09-secondary-use.md) | Secondary use under revocable consent | `roadmap` | 2 |
| [F-10](F-10-continuous-data.md) | Wearables and continuous data | `roadmap` | 3 |

## What is deliberately not here

- **Wallet internals.** How a wallet stores, backs up or restores credentials is
  the wallet's concern and is specified by the Confederation.
- **Billing.** The practice bills through existing channels; making that a flow
  would imply the trust infrastructure replaces it, which it does not.
- **Identity proofing.** How a person obtains an e-ID is upstream of everything
  here. F-01 covers *organisational* onboarding only.
