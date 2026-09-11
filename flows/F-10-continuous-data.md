---
id: F-10
title: Wearables and continuous data
status: roadmap
roadmap_step: 3
actors:
  - holder
  - device manufacturers
  - ch.didas.health.role.practice
credentials:
  - continuous measurement credential types (not modelled)
protocols:
  - to be determined
trust_markers:
  - device attestation, not yet specified in the Swiss Profile
preconditions:
  - F-07
produces:
  - Clinically usable continuous data held by the patient
---

# F-10 · Wearables and continuous data (roadmap, 2028)

Roadmap step 3, the Swiss Health App. Sketched to record why it is hard, and not to
suggest it is close.

Everything in steps 1 and 2 shares a shape: discrete, low-frequency, authored
events. A dose was administered. A prescription was written. A sample was
analysed. Each has an author who can be held responsible, and each fits in a
credential.

Continuous data does not have that shape.

## Why the credential model does not transfer directly

- **Volume.** A credential per heart-rate reading is absurd; the swiyu Wallet's
  payload limit is 20 MB per issuance batch, and a year of continuous monitoring
  is orders of magnitude beyond anything this architecture was designed for.
  Summary credentials over a period are the plausible unit — which reintroduces
  the question of who computes the summary and whether it can be trusted.
- **Authorship.** A practice attests a vaccination. What attests a step count?
  The device manufacturer can attest that a device produced a reading; nobody can
  attest that the reading describes the person holding the wallet. Device
  attestation exists in the profile for *key storage*, not for measurement
  provenance, and the gap is not incidental.
- **Clinical weight.** Consumer-device data is not diagnostic. A credential
  format lends it an air of authority it has not earned, and a clinician seeing a
  signed credential may reasonably read more into it than is there. This is a
  safety argument against making it too easy.
- **Continuous consent.** F-03's model — the holder sees a request and decides —
  does not fit a standing data flow. Consent to ongoing sharing is a different
  primitive and the one most likely to be implemented badly.

## What would have to exist first

1. A summary-credential pattern with an accountable computation step.
2. A measurement-provenance model distinguishing "this device produced this" from
   "this describes this person".
3. Standing-consent semantics with a visible, revocable state the holder can
   inspect.
4. openEHR and FHIR models for the summary types — the modelling work of F-07
   applied to a data shape neither standard handles as comfortably as events.

None of these are step-1 problems, and treating them as such would produce the
worst outcome available: a demo that makes an unsolved safety question look
solved.
