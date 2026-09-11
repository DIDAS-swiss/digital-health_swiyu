# Governance framework

The technical profile answers *can this message be validated*. This document
answers the questions that decide whether health data should change hands at
all: who may assert something, who may ask for it, which claims specifically,
on what legal basis, and what happens to the data afterwards.

Everything described here is implemented and enforced in
[`packages/swiyu/src/governance.ts`](../packages/swiyu/src/governance.ts).
Where something is *not* implemented, it says so.

## Principles

1. **Minimisation is enforced where the query is built.** Once the wallet has
   answered, the data is out. A check at the verifier is a promise; a check at
   query construction is a control.
2. **A role is granted, never claimed.** An actor's entitlements derive from
   trust statements published by someone accountable. What its software asserts
   about itself carries no weight.
3. **MUST and SHOULD are kept apart.** Profile-level MUST rules are enforced
   under every policy. SHOULDs may be waived — and a waiver is *recorded*, not
   silently applied.
4. **The audit record holds claim names, never claim values.** It must prove an
   interaction stayed within the rules without becoming a second copy of the
   patient's data.
5. **Refusal is a first-class outcome.** A holder declining, and a verifier
   being refused, are normal paths that the flow has to work through — not
   errors.

## Actors and roles

A role is a registered capability. One organisation holds several: a family practice is also an authorised vaccinator and often runs its
own laboratory.

| Role | Identifier | Issues | Verifies |
| --- | --- | --- | --- |
| Insurer | `ch.didas.health.role.insurer` | Insurance card | — |
| Practice | `ch.didas.health.role.practice` | Prescription | Insurance card, Beta-ID, immunization, prescription |
| Vaccinator | `ch.didas.health.role.vaccinator` | Immunization | — |
| Laboratory | `ch.didas.health.role.laboratory` | Laboratory report | — |
| Pharmacy | `ch.didas.health.role.pharmacy` | — | Prescription, immunization, insurance card (limited) |
| Travel clinic | `ch.didas.health.role.travel-clinic` | — | Immunization (4 claims) |
| Research | `ch.didas.health.role.research` | — | Lab findings, immunization — never identifying claims |

The full per-claim entitlement matrix is generated from the definitions:
[docs/credentials/README.md](credentials/README.md).

## The three gates

Every interaction passes through the gates that apply to it, in order, and each
records its reasoning either way.

### Gate 1 — `reviewIssuance()` · may this actor assert this?

Checked before any request reaches the issuer. An actor may issue a credential
type only if one of its registered roles is that type's `issuerRole`.

> A practice may issue an immunization record because it holds the vaccinator
> role. An insurer may not, and is refused before a credential offer exists.

Underneath, this corresponds to a Governed Use Case Authorization Trust Marker
naming the credential type. **That marker cannot currently be issued** — see
[The missing layer](#the-missing-layer).

### Gate 2 — `reviewRequest()` · may this actor ask, and for what?

Checked when the DCQL query is constructed. Three tests:

1. Does the requesting role hold an entitlement for this credential type?
2. Do the requested claims fall inside that entitlement?
3. Are any protected fields among them, and is this role authorised for those
   specific fields?

A failure at any point stops the request before the patient sees it.

### Gate 3 — `reviewPresentation()` · should this be accepted?

Checked on the response, in a deliberate order:

1. **Status list first.** Revoked or suspended fails immediately, before any
   trust reasoning.
2. **Technical validity.** Signature, key binding, issuer DID resolution — all
   performed by the generic verifier.
3. **Trust markers**, against the configured policy.

## Trust markers and policies

The generic verifier evaluates Trust Protocol 2.0 markers on the credential's
issuer. The policy decides what to do with them.

| Marker | Meaning | Strict | Sandbox |
| --- | --- | --- | --- |
| `gucTM` without `gucaTM` | Governed use case, no authorisation | **Refuse** | **Refuse** |
| `viTM` | Verified identity | Require | Waive, and record the waiver |
| `caTM` | Compliant actor | Require | Waive, and record the waiver |

The first row is a MUST in `swiss-profile-trust:1.0` and is not configurable —
it is refused under every policy, including the Sandbox one.

`SANDBOX_HEALTH_POLICY` exists because Sandbox actors have not been through
identity onboarding, so the SHOULD-level rules cannot be satisfied there. The
rules are not deleted; each waiver appears in the journal with its reason. A
demonstrator that silently drops rules teaches that the rules are optional.

Production deployments set `SWIYU_TRUST_POLICY=strict` and mean it.

## Protected fields

`swiss-profile-trust:1.0` designates certain claims as **protected**: a verifier
needs an explicit authorisation to request them, *whatever credential type
carries them*.

| Field | Why |
| --- | --- |
| `personal_administrative_number` | The AHV/AVS number — a lifelong cross-sector identifier |

The practice holds this entitlement because Swiss billing runs on the AHV
number. The pharmacy does not, and a pharmacy request for it is refused at gate
2 — asserted in `packages/swiyu/test/governance.test.ts`.

The entitlement is written into the credential definition precisely so it is
reviewable. "Which of our partners can see the AHV number" should be a question
answerable by reading one file.

## Legal basis, by credential type

| Credential | Issuer acts under |
| --- | --- |
| Insurance card | KVG/LAMal Art. 42a — the insurer issues the card |
| Immunization | EpG/LEp and the cantonal authorisation to vaccinate |
| Prescription | MedBG/LPMéd — only a registered practitioner may prescribe |
| Laboratory report | A laboratory on the KVG analysis list, or the treating practice on its behalf |

These are recorded as `issuerBasis` on each credential type and surface in the
journal entry for every issuance.

## Retention

Retention attaches to the receiving role:

- **Practice** — disclosed claims may be kept as long as the billing record
  requires (10 years, OR Art. 958f).
- **Pharmacy** — a dispensation record under HMG/LPTh; not the credential.
- **Travel clinic** — the conclusion that the series was confirmed, without a
  copy of every dose.
- **Research** — only what the consent covers, and never identifying claims,
  which the entitlement makes unobtainable anyway.

Note that building a FHIR resource from a presentation *is* retention. The
projection is governed by the same rule as the claims it was built from.

## Lifecycle governance

Three operations share one mechanism and must not be confused:

| Operation | Status | Reversible | Means |
| --- | --- | --- | --- |
| Suspend | `0x02` | Yes, via `ISSUED` | "Do not rely on this for now" |
| Revoke | `0x01` | **No** | "This assertion should not have been made" |
| Cancel | `0x01` | No | The offer was withdrawn before collection |

**The status list cannot distinguish motive.** "Recorded in error", "used up"
and "we no longer recognise this" produce the same bit. Only the issuer's
journal separates them, which is what makes the journal a governance control.

Two rules follow, neither technically enforceable:

- **An immunization credential may be revoked only to correct a recording
  error** — never to withdraw a vaccination that took place. Revoking does not
  undo the dose; it withdraws an assertion the issuer should not have made.
- **A prescription is revoked on dispensing**, which is what makes it
  single-use. Only the issuer can revoke, so redemption is a request between two
  accountable parties.

Status list contents are **public**. A suspension is therefore a disclosure —
a reason to prefer correction-by-revocation over suspension-on-suspicion for
sensitive credential types.

## The audit journal

Every gate decision produces a record:

```
timestamp · interaction id · actor role · actor DID · credential type
purpose scope · claim NAMES released · decision · reasons · retention rule
```

Deliberately absent: claim values. A test asserts that no AHV number and no
vaccine lot number ever reaches the journal.

This is what a practice must be able to show afterwards — who asked, for what
purpose, under which entitlement, what was released and what was decided —
without the record becoming a shadow copy of the patient's data.

## Transparency: the vqPS

Separately from entitlement, each verifier **publishes what it asks for**. A
Verification Query Public Statement carries a scope, a localised purpose and the
DCQL query itself, signed and published to the Trust Registry.

This is self-service and available today. It is generated from the same objects
the verifier sends (`scripts/vqps.ts`), because a published statement that has
drifted from its implementation is worse than none: it is a public claim that
happens to be false.

## The missing layer

Organisation onboarding, identity onboarding and transparency are all
self-service and working. One layer is not.

| Layer | Establishes | Available |
| --- | --- | --- |
| Organisation | ePortal account, business partner, API access | **Yes** |
| Identity | `did:webvh` on the Base Registry, proof of possession → `viTM` | **Yes** |
| Transparency | vqPS: this verifier, this scope, this query | **Yes** |
| **Entitlement** | `gucaTM`: this DID may issue *this* health credential type | **No** |

**No health-domain governance body exists** to issue that last marker. Until one
does, verification relies on explicitly listed `accepted_issuer_dids` — adequate
for a pilot, inadequate at scale, since every verifier must be told about every
legitimate issuer out of band.

### What such a body would have to do

1. **Define the role vocabulary** — and decide whether it is health-specific or
   shared across sectors, which determines whether a verifier in another domain
   can interpret a health role at all.
2. **Grant roles against existing registers** — the cantonal authorisation to
   practise, the MedReg entry, the GLN in Refdata, the BAG number for insurers.
   A grant not traceable to one of these is a new register in disguise.
3. **Withdraw them.** When an authorisation to practise is revoked, the trust
   statement must follow, or credentials issued afterwards still verify. Nothing
   in the technical stack notices this on its own.
4. **Adjudicate entitlements** — decide which roles may request which claims,
   and publish that decision.
5. **Run an appeal path.** A trust registry entry has real economic
   consequences for a practice.

## Open governance questions

1. **Who governs the health domain?** A cantonal health authority, the FOPH, a
   sector association, or a body constituted for the purpose. Unanswered.
2. **How are roles expressed in a trust statement?** This project uses reverse
   DNS strings. Whether the ecosystem adopts a shared vocabulary decides
   cross-sector interpretability.
3. **Representation and delegation.** A parent for a child, a carer for an
   adult. No model exists, and this blocks the largest real population for
   immunization records.
4. **Emergency access.** Consent-at-presentation assumes a conscious patient.
   Any break-glass mechanism reintroduces the party this design removes.
5. **Notification.** Nothing tells a patient that a credential they hold has
   been revoked. For a vaccination record that is potentially a clinical risk.

---

Each flow in [`flows/`](../flows/README.md) carries its own governance
constraints section, stated against the specification clause it comes from.
