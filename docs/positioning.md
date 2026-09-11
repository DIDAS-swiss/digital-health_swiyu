# Positioning

## Two showcases, one hackathon

At the GovTech Hackathon 2026 the Swiss vaccination record was taken up twice,
from opposite ends.

**Project 28**, from openEHR Switzerland, is the "2026 Showcase Impf-Modul":
vaccination data arrives as FHIR in CH VACD format, is validated against
profiles and terminology, and is persisted semantically as an openEHR
COMPOSITION in a clinical data repository — explicitly "not as a JSON blob". It
has since been picked up by a joint working group of openEHR Switzerland and HL7
Switzerland, whose stated aim is to turn it into a reusable, governable
implementation blueprint covering clinical models, terminology bindings, mapping
artefacts, demographic references, transformation logic and orchestration, with
FHIRconnect and openFHIR doing the bidirectional mapping and a FHIR façade over
the repository. It is offered as extensible to further clinical domains and to
the Swiss Health Data Space.

**This repository** takes the lineage of project 1103 from the 2024 hackathon
forward onto the swiyu trust infrastructure. It reuses the same clinical models
— the same archetypes, the same CH VACD element paths, the same terminology
bindings — and declines the repository. A vaccination is issued to the patient's
wallet as an SD-JWT verifiable credential; presentation is selective, consent is
per-request, and there is no server, federal or otherwise, that holds the
record.

The instruction that shaped this repository was explicit: reuse the schemas,
without the centralised openEHR approach, on the basis of verifiable
credentials. The two showcases are therefore deliberate alternatives, and this
document says what that costs.

## The objection

The openEHR position is this:

> A vaccination record must remain clinically usable throughout a person's
> lifetime, and a document exchanged at a particular point in time is not the
> same as a longitudinal record maintained over decades.

This is correct, and it is the strongest argument against the design in this
repository. A credential is a signed statement about one event, made at one
moment, by one issuer. Forty years of immunisations are forty such statements,
held by a person who has changed phones eleven times, whose issuers have merged,
been dissolved, or rotated their keys, and several of whom no longer exist to be
asked. An openEHR CDR answers "is this patient protected against diphtheria?" as
a query. A wallet answers it as an act of retrieval that the patient must
perform, from a collection they alone are responsible for having kept.

Three specific consequences follow, and none of them is solved here:

1. **Series reconciliation.** F-02 acknowledges it: the prototype cannot reliably
   tell a third dose from a duplicate record of the second, because it has no
   view of the series — only of the credentials the holder chose to present.
2. **Correction and supersession.** F-06 acknowledges it: revoking a credential
   makes it unusable but does not notify the holder or place the corrected
   record beside it. In a CDR, a correction is a new version of a known object.
3. **Custody over decades.** Key rotation, device loss, inheritance, incapacity.
   The swiyu wallet has a recovery story; a forty-year one, across issuers who
   have ceased to exist, remains undemonstrated here.

In summary, this repository is strong where the CDR
approach is weak — consent, selective disclosure, no central store to breach or
to be compelled — and weak exactly where it is strong.

## What the 2024 lineage already learned

The objection also arose inside the DIDAS project. Its own follow-on
repository records, in its learnings log, a pivot:

> Architecture changed from verifiable credentials as «source of truth» to
> referenced information to accommodate for other sources of health data (e.g.
> local Apple HealthKit / Android Health Connect, remote EHR).

The same conclusion, reached from the wallet side and for a more mundane reason:
health data has other homes, and a wallet that insists on being the only one
loses. That was written before this repository existed, and it argues against
the strongest form of the position this repository takes.

So the defensible claim is narrower than "records belong in the wallet":

**A credential is the right carrier for a fact that a specific party attested at
a specific moment, and that a patient needs to present to someone who has no
right to their whole record.** A vaccination at a border. Cover at a reception
desk. A prescription at a pharmacy counter. Each of these is a presentation, and
the wallet is the right instrument for a presentation.

For "what is this patient's immunisation status", the right instrument is a
longitudinal record, and a credential answers only one dose of it.

## The 2024 staging, where the two meet

Project 1103 published a three-stage transition, and it remains the clearest
frame available:

1. **Document-oriented ("EPD 1.0")** — the current Swiss EPR: reports as PDFs,
   which makes search and automated processing all but impossible.
2. **Structured, server-based ("EPD 2.0")** — structured, standardised clinical
   information on server technologies that are readily available today.
3. **Structured, wallet-based ("EPD 3.0")** — the same standards, carried as
   verifiable credentials in the wallets of the E-ID trust infrastructure.

with the caveat, from the same document, that "there will certainly be extended
transition periods and overlaps between the above stages".

Project 28 is a working demonstration of stage 2. This repository is a working
demonstration of stage 3. They are not rival answers to one question; they are
adjacent stages, and the overlap between them is the interesting part.

## Where they compose

The models are the shared surface, which is why this repository reuses them:

- Every claim here carries its **CH VACD / CH EMED / CH Core FHIR element path**
  and its **openEHR archetype and CKM node name**, verified against the
  published archetypes (see [source verification](source-verification.md)).
- `projectToFhir` and `projectToOpenEhr` turn a presented credential into a
  CH VACD `Immunization` or a flat openEHR composition at the point of receipt.

Which means the composition is already specified, and in both directions:

**Repository → wallet.** A CDR holding a patient's immunisations can issue any
one of them as a credential, because the credential's claims are already
archetype-bound. The patient gains a presentable artefact; the CDR keeps the
longitudinal record. This is the case this repository's F-02 already models — it
simply assumes the issuer is a practice, and nothing in the flow depends on
that.

**Wallet → repository.** A presented credential projects to a CH VACD
`Immunization` that a FHIR façade accepts and FHIRconnect maps to a COMPOSITION.
That is the same ingestion path project 28 already built. The credential then serves as a
signed, consented, verifiable statement of provenance for a record entry. That
is better provenance than the CDR would otherwise have, because it carries the
issuer's own signature over the content, and a transport-level assertion about
who sent the data carries only the sender.

The unresolved question is a governance one: who governs the models when both
stages are live. That is the joint working group's remit, and a good reason for
this repository's flows to be transferable to it.

## Divergences

Places where this repository knowingly differs from the sources it draws on:

| Topic | Source | Here | Why |
| --- | --- | --- | --- |
| Medication coding | Project 1103 used ATC (`A02BC01`) | GTIN | A pharmacy dispenses against a package; CH EMED carries both codings, and step 2 should too |
| Insurance identity | Project 1103 keyed the insurance proof on AVS13 | AVS13 present but governed | `personal_administrative_number` is a protected field under swiyu Trust Protocol 2.0; asking for it needs an entitlement, and the check-in flow does not ask |
| Signature format | Project 1103 used AnonCreds via VCMS, with SD-JWT planned | SD-JWT VC only | The Swiss Profile permits nothing else: ISO mdoc and W3C VCDM are NOT SUPPORTED |
| Persistence | Project 28 persists to a CDR | No persistence | The point of the exercise; the projections exist so that a deployment can choose otherwise |
| Allergies | Project 1103's wallet carried allergies | Not implemented | Roadmap step 2 (IPS); the check-in flow requests cover only |

That last row is a functional gap against the project this repository set out to
implement, and it is recorded as such in [the roadmap](roadmap.md).
