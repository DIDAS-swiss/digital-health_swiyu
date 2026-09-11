---
id: F-05
title: Prescription and its redemption
status: implemented
roadmap_step: 1
actors:
  - ch.didas.health.role.practice
  - ch.didas.health.role.pharmacy
  - holder
credentials:
  - urn:vct:ch.didas.health.prescription:1.0
protocols:
  - OpenID4VCI 1.0 (issuance)
  - OpenID4VP 1.0 (presentation)
  - Token Status List draft-20 (redemption)
trust_markers:
  - gucaTM on the prescriber
preconditions:
  - F-04
produces:
  - A single-use prescription credential, consumed by revocation on dispensing
---

# F-05 · Prescription and its redemption

A prescription is an authorisation that must be usable exactly once. This flow
is included because it is the case where "put it in a wallet" is *not* obviously
sufficient — a credential can be presented any number of times — and the answer
turns out to be interesting.

## Single use without a central register

The mechanism is the status list. The pharmacy dispenses and then asks the
issuing practice to revoke; the bit flips on the list published to the Base
Registry; every later presentation fails. Three properties follow:

- **No register of who was prescribed what.** The status list records that a
  credential is no longer valid. It contains no patient, no medication, no
  pharmacy — the privacy improvement over a central e-prescription service is
  structural: the status list is the only place the single-use property is
  recorded, so the guarantee holds for every verifier that checks it.
- **Only the issuer can revoke.** The pharmacy cannot flip the bit itself, so
  redemption is a request between two accountable parties. This is a feature: it
  forces the dispensing event to be visible to the prescriber, which is what the
  paper world achieves by taking the paper away.
- **The race is real.** Between presentation and revocation there is a window in
  which a second pharmacy could accept the same credential. Paper has the same
  window and closes it physically. See the open questions.

```mermaid
sequenceDiagram
    autonumber
    participant P as Practice
    participant GI as swiyu-issuer (practice)
    participant W as Patient wallet
    participant Ph as Pharmacy
    participant GV as swiyu-verifier (pharmacy)
    participant BR as Base Registry

    P->>GI: Create offer (medication[], exp = +1 year)
    GI-->>W: Credential collected (QR → OID4VCI)
    Ph->>GV: Create verification (10 claims, purpose ch.didas.health.dispense)
    GV-->>W: Signed JAR via QR
    W->>GV: Encrypted presentation
    GV->>BR: Status check → VALID
    GV-->>Ph: Claims + evaluation
    Ph->>Ph: Hand over the medication
    Ph->>P: Redemption request
    P->>GI: PATCH …/status?credentialStatus=REVOKED
    GI->>BR: Publish; bit → INVALID
    Note over W: The credential remains in the wallet<br/>and no longer verifies
```

## Governance constraints

- **Only a prescriber may issue.** MedBG/LPMéd; enforced through `issuerRole`
  and, in a real deployment, `gucaTM`.
- **Revocation here means "used up".** The same mechanism
  serves both, and the status list cannot distinguish them. The distinction has
  to live in the issuer's own record, which is why the redemption request is
  journalled with its reason.
- **`repeats_authorized` is not implemented as repeat dispensing.** The claim is
  carried and shown, but the single-use mechanism revokes on first dispensing.
  Supporting repeats properly needs either re-issuance per repeat or a decrement
  the status list cannot express. Recorded here as a gap.
- **The pharmacy retains a dispensation record** under HMG/LPTh; it does not
  retain the credential.
- **Substitution stays a professional decision.** `substitution_allowed` informs
  the pharmacist; nothing in the flow enforces it.

## Standardisation constraints

- The medication list is a selectively disclosable array of objects, using
  array-element and recursive disclosures — both required of wallets by the
  profile and recommended for exactly this shape.
- `credential_refresh_disabled` is set: allowing the wallet to silently re-fetch
  a prescription from the credential endpoint would undo the redemption model.
- `exp` is set to the prescription's validity. Past `exp` the credential cannot
  be presented at all — stricter than `expiry_date`, which only warns the holder
  and leaves the decision to the verifier.
- FHIR `MedicationRequest` (CH EMED) and openEHR
  `openEHR-EHR-INSTRUCTION.medication_order.v3` bindings per claim; the
  projection in F-07 rebuilds either representation locally.

## Open questions

1. **The double-dispensing window.** Options: the pharmacy revokes through a
   delegated authorisation from the issuer; the issuer suspends on presentation
   and revokes on confirmation; or the ecosystem accepts a window no worse than
   paper's. Unresolved, and the most substantive gap in this flow.
2. **Partial dispensing.** Handing over one of three prescribed items has no
   representation: revocation is all-or-nothing.
3. **Who revokes when the practice has closed?** A prescription outlives its
   issuer's ability to revoke it, which is the uncomfortable mirror image of the
   property F-02 celebrates.

## Implementation status

`implemented`. Issuance, dispensing and the second-attempt failure are covered
in `apps/demo/test/journey.test.ts`.
