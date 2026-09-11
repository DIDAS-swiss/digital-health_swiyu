---
id: F-09
title: Secondary use under revocable consent
status: roadmap
roadmap_step: 2
actors:
  - ch.didas.health.role.research
  - holder
credentials:
  - urn:vct:ch.didas.health.lab-report:1.0
  - urn:vct:ch.didas.health.immunization:1.0
protocols:
  - OpenID4VP 1.0 (swiss-profile-verification:1.0.0)
trust_markers:
  - viTM
  - caTM
  - gucaTM naming the research use case
preconditions:
  - F-02
  - F-03
produces:
  - A de-identified contribution, with consent that can be withdrawn
---

# F-09 · Secondary use under revocable consent (roadmap, 2027)

Roadmap step 2. The entitlement model is implemented and tested; the flow around
it is not built.

Research access to health data is normally a negotiation between institutions
about a dataset the patient is not party to. Selective disclosure changes the
shape of that: a research entitlement can be defined so that the identifying
claims are *unobtainable*, where an undertaking is a promise to leave them unused.

In `LAB_REPORT`, the research role's entitlement is `findings`, `specimen_date`
and `report_date` — and nothing else. `reviewRequest()` refuses a request from
that role for `patient_family_name`, which is asserted in
`packages/swiyu/test/governance.test.ts`. The refusal happens when the query is
built, before the patient is ever asked.

## What step 2 has to solve

- **Consent as a credential.** A consent that can be withdrawn needs to be an
  object with a lifecycle, held in the wallet and revocable there. A consent
  credential issued by the holder to the researcher, revocable through the same
  status list mechanism as everything else, is the obvious shape — and it inverts
  the usual direction of issuance, which the trust infrastructure does not
  currently contemplate.
- **Withdrawal semantics.** Revoking consent stops future presentations. It does
  not recall data already contributed, and a design that implies otherwise is
  dishonest. What withdrawal can guarantee needs stating in the consent text
  itself.
- **Re-identification risk.** Four LOINC-coded findings with dates are not
  anonymous. A minimisation envelope is not de-identification, and claiming
  otherwise would be the weakest argument in this blueprint. k-anonymity, date
  coarsening or aggregate-only queries belong here.
- **HFG/LRH compliance.** The Swiss Human Research Act governs this whole area
  and has its own consent requirements, which a technical consent mechanism must
  satisfy: the consent object and the minimisation envelope are evidence a
  review board can inspect, and the board still has to approve the study.
- **Aggregation without a collector.** If the point is to avoid a central
  repository, the destination of a research contribution needs thought: a study
  database is a central repository. Federated analysis or local computation over
  presented data is the coherent answer and is substantially harder.

## Why it is not built here

The mechanism that makes it interesting — entitlements that exclude identifying
claims by construction — is implemented and tested. The rest is governance work
that a hackathon prototype cannot legitimately shortcut.
