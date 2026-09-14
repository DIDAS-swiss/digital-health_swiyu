# Review status

This page separates three things that must not be conflated:

1. requirements stated by the current Swiss Profiles;
2. implementation and governance choices made by this demonstrator;
3. requirements that the current profiles do not define or do not define clearly.

For clause-level conformance, see [Swiss Profile conformance](spec-conformance.md).
For source provenance, see [Source verification](source-verification.md).
For requirements beyond or unclear in the current profiles, see
[Swiss Profile gaps](swiss-profile-gaps.md).

Current as at 2026-09-13 against Swiss Profiles 1.0 and Trust Protocol 2.0.

## Classification

| Classification | Meaning |
| --- | --- |
| **Current Swiss Profile** | The applicable profile states the requirement or mechanism. |
| **Implementation choice** | A technical choice made by this demonstrator. |
| **Governance choice** | A role, entitlement or policy defined by this demonstrator. |
| **Beyond current Swiss Profile** | A required capability for which the current profiles define no mechanism. |
| **Unresolved** | The available specification or evidence does not settle the point. |

Implementation in this repository does not imply production deployment,
standards endorsement, legal approval or clinical validation. Nothing in this
repository has been run against production swiyu.

## Current-profile mechanisms used here

The demonstrator relies on the following mechanisms defined by the current
Swiss Profiles:

- SD-JWT VC as the credential format;
- the pre-authorized issuance flow;
- signed JAR requests carrying OpenID4VP authorization requests, with `response_mode=direct_post.jwt`;
- DID-based authority constraints in DCQL;
- Token Status List status resolution;
- Trust Protocol 2.0 statement validation and derivation of `viTM`, `caTM`, `tvTM`, `gucTM` and `gucaTM`;
- the authorisation requirement for protected fields defined in `swiss-profile-trust:1.0`.

The exact clauses and project enforcement are listed in
[spec-conformance.md](spec-conformance.md).

## Demonstrator choices

The following are project choices rather than Swiss Profile requirements:

- one credential per administered dose;
- the `ch.didas.health.role.*` role vocabulary;
- per-role issuance rights and claim-request entitlements;
- explicit accepted issuer DIDs as a pilot control;
- an audit journal that records claim names but not claim values;
- FHIR and openEHR mappings used by the projection layer.

These choices may be replaced by another conformant implementation.

## Unresolved or beyond-profile requirements

The detailed register is maintained in
[swiss-profile-gaps.md](swiss-profile-gaps.md). The current set covers:

- multi-credential and multi-instance presentation semantics;
- provenance when a verified presentation is transformed into FHIR or openEHR;
- holder-originated authorisation objects;
- standing authorisation for continuous exchange;
- measurement and device provenance;
- richer lifecycle and status semantics;
- credential supersession and replacement;
- predicate or derived-attribute presentation;
- correlation surfaces across repeated presentations;
- cross-domain and cross-border recognition of organisational authority.

The register states the requirement and the current limitation. It does not
claim that a proposed solution has been selected, implemented or endorsed.

## Review boundary

The repository can establish what its code, configuration and tests do. It can
trace profile requirements to published specifications. It cannot establish
legal applicability, clinical suitability, production behaviour outside the
demonstrator, or governance decisions that no competent body has made.

## Further work

Further work should be organised around concrete use cases. Healthcare actors,
regulators, patient representatives and implementers need to examine the
benefits, risks and governance questions in the context in which a flow would
actually be used, and to test proposed mechanisms before treating them as
settled. Results from those experiments can then be used to refine the
technical and governance model iteratively.

Where a proposed pilot requires a temporary deviation from rules under the
Federal Health Insurance Act, Article 59b KVG provides a legal basis for
approved pilot projects that can, among other objectives, strengthen quality or
promote digitalisation. Its applicability has to be assessed for the specific
use case; it is not a general sandbox for all health regulation.
