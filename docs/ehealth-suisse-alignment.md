# eHealth Suisse alignment

What this project takes from the Swiss national specifications, what it
repurposes, and where it diverges.

The premise is that a health credential is worth little if the receiving system
has to learn a new vocabulary to read it. Switzerland already has the
vocabulary: eHealth Suisse publishes the exchange formats, the identifier
naming systems and the terminology bindings that the EPR runs on, and CH VACD is
legally mandated for use within it. So the claims here are bound to those
definitions, and where this project needed something the standards already
model, the standard's shape was adopted.

Everything below was read from the published FHIR Implementation Guides —
[`hl7ch/ch-core`](https://github.com/hl7ch/ch-core),
[`hl7ch/ch-vacd`](https://github.com/hl7ch/ch-vacd) and
[`hl7ch/ch-epr-term`](https://github.com/hl7ch/ch-epr-term) — cloned and read in
this repository's working environment. `fhir.ch` itself is unreachable from
here, so the rendered guides were not consulted; see
[source verification](source-verification.md) for what that distinction means.

## Identifiers — reused as published

CH Core defines each Swiss identifier as a profile with a fixed `system`. Those
OIDs are now what the credential claims carry.

| Identifier | OID | CH Core profile | Used in |
| --- | --- | --- | --- |
| AHVN13 / NAVS13 | `urn:oid:2.16.756.5.32` | `AHVN13Identifier` | Insurance card, as the protected `personal_administrative_number` |
| Insurance card number (VEKA) | `urn:oid:2.16.756.5.30.1.123.100.1.1.1` | `VEKAIdentifier` | Insurance card `card_number` |
| GLN | `urn:oid:2.51.1.3` | `GLNIdentifier` | Immunization `performer_gln`, prescription `prescriber_gln` |
| GTIN | `urn:oid:2.51.1.1` | CH EPR Term naming system | Prescription `medication.code` |
| BER (Business and Enterprise Register) | `urn:oid:2.16.756.5.45` | `BERIdentifier` | Insurance card `insurer_ber_number` |
| EPR-SPID | `urn:oid:2.16.756.5.30.1.127.3.10.3` | `EPRSPIDIdentifier` | Not used — see below |
| ZSR / RCC | `urn:oid:2.16.756.5.30.1.123.100.2.1.1` | `ZSRIdentifier` | Not used — billing is out of scope |

Three of these were wrong before this check and are now corrected:

- **The VEKA number carried no naming system at all**, and its pattern allowed
  any 20-digit number starting `807`. CH Core requires exactly 20 digits
  starting `807560`.
- **`urn:oid:2.16.756.5.45` was labelled "BAG-Nummer".** It is the Business and
  Enterprise Register. The five-digit BAG insurer number is a different
  identifier and CH Core publishes no naming system for it, so the claim was
  renamed to `insurer_ber_number` and bound to the register CH Core does
  define.
- **GTIN used `https://www.gs1.org/gtin`** as its system. CH EPR Term publishes
  GTIN as `urn:oid:2.51.1.1`.

## The minimisation rule, arrived at from both directions

`CHCorePatientEPR` — the patient resource for documents shared inside the EPR —
sets both identifiers to `0..0`:

```
* identifier[EPR-SPID] 0..0
* identifier[AHVN13]   0..0
```

Neither the sectoral EPR identifier nor the AHV number may appear in a document
shared through the EPR. The Swiss standard forbids them outright.

This project reaches the same place through a different mechanism. The swiyu
Trust Protocol lists `personal_administrative_number` as a **protected field**:
a verifier needs an explicit authorization marker to request it, whatever
credential carries it. The practice holds that entitlement because it bills with
the number; nobody else in this project does, and the check happens where the
query is built.

Two systems, two mechanisms, one conclusion. That agreement is worth more than
either rule on its own, and it is the clearest evidence that binding to the
national models is doing real work here.

EPR-SPID is deliberately absent from every credential. It is the identifier that
makes a record findable in the EPR, and a design with no repository to search
has no use for it.

## Clinical models — reused

| Credential | CH profile | openEHR archetype |
| --- | --- | --- |
| Immunization | `ch-vacd-immunization` (CH VACD) | `openEHR-EHR-ACTION.medication.v1` + `CLUSTER.medication.v2` |
| Prescription | `ch-emed-medicationrequest` (CH EMED) | `openEHR-EHR-INSTRUCTION.medication_order.v3` |
| Laboratory report | `DiagnosticReport` + `Observation` | `openEHR-EHR-OBSERVATION.laboratory_test_result.v1` + `CLUSTER.laboratory_test_analyte.v1` |
| Insurance card | `Coverage` over CH Core identifiers | none — openEHR models the clinical record, and cover is not one |

Each claim carries its element path in both, with the openEHR binding naming the
archetype and the node as published in the Clinical Knowledge Manager. A
verifier rebuilds whichever representation it already understands, locally, from
what the holder released.

## Repurposed — CH VACD mechanisms adopted for open questions

Three problems this project had recorded as open questions turn out to be
modelled already in CH VACD. Those shapes are adopted here.

### Supersession — `relatesTo`

`ch-vacd-immunization` carries an `EntryResourceCrossReferences` extension whose
stated purpose is "to identify the replaced/corrected entry in an other
document", referencing both the entry and its containing composition.

F-06 records that this project can revoke a credential but cannot say what
replaced it. The CH VACD reference shape is the answer: a corrected credential
names the one it supersedes, so a verifier holding both can tell which stands.
Modelled in the `correction` view; not yet implemented.

### Series reconciliation — `conflict`

`CHVACDExtensionMergingConflictEntryReference`, described as an "indicator for
merging conflicts", exists because CH VACD expects records of the same
vaccination to arrive from several sources and disagree.

F-02 records exactly this as its first open question: a wallet holding two
"dose 1 of 3" credentials from different issuers cannot tell a genuine second
dose from a duplicate record of the first. That a national standard needed the
same construct is evidence that the problem is structural, and that
holder-held records merely expose it.

### Practitioner verification — `verificationStatus`

`CHVACDExtensionVerificationStatus` is **mandatory** (`1..1`) on every CH VACD
immunization, and its definition is blunt: "Attention: changes the
interpretation of the content of the resource!" It exists so a practitioner can
state whether they verified data entered by a patient or a relative.

In a credential the issuer's signature already answers this for anything a
practice issued. It does not answer it for a dose the patient recorded
themselves, which roadmap step 2 will have to carry. A credential that cannot
distinguish "the practice that administered this says so" from "the patient
typed it in" is not safe to treat as equivalent to a CH VACD record, and the
standard says so in a required field.

### Travel indication — already modelled

`CHVACDTravelInformation` binds SNOMED CT `129018004` "Traveling" to a travel
location and a period, as the indication for a travel vaccination
recommendation. F-03's travel clinic is the same use case, and a deployment
issuing a recommendation should use this profile.

## Diverged, with reasons

| Topic | eHealth Suisse | Here | Why |
| --- | --- | --- | --- |
| Where the record lives | EPR repositories, addressed by EPR-SPID | The patient's wallet | The project's premise. [positioning.md](positioning.md) states the case against it |
| Vaccine coding | Concept maps across SNOMED CT, Swissmedic, NUVA and legacy Swiss codes | SNOMED CT only | One coding is enough for a showcase; a deployment carries the map, which CH EPR Term publishes |
| Document granularity | A vaccination record **document** per patient | One credential per administered dose | Authorship stays with whoever administered. The cost is that "is the series complete?" spans credentials |
| Performer | `performer.actor only Reference(CHCorePractitionerRole)` | A GLN and a display name | The role is carried by the issuer's trust statement, which is the same idea reached through the trust registry |
| Recommendation service | `CHVACDRecommendationRequestMessage` / `ResponseMessage`, a FHIR messaging exchange | Not implemented | Roadmap step 2. It is the natural answer to "is this series complete?", and it needs a service to ask |

## What this does not claim

No resource produced by `projectToFhir` has been run through a FHIR validator,
and no profile conformance is asserted beyond naming the profile a resource is
shaped towards. The bindings are correct as *references* — the OIDs, archetypes
and node names were each checked against the published source — and untested as
*instances*.

That gap is the first thing to close before any of this is offered to a system
that trusts it. A validator in CI, running the projections against the CH
packages, would turn the claims in this document into checks.
