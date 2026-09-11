# Source verification

What in this repository was checked against a primary source, what rests on a
secondary source, and what could not be verified here at all.

The project's claims fall into visibly different classes. "`nonce_endpoint` is
REQUIRED" was read out of the profile text. "The insurer issues the insurance
card under KVG/LAMal Art. 42a" is a legal statement that reads with the same
confidence and has no such backing behind it. Setting both in the same typeface,
in the same tables, without saying which is which, is itself a defect.

Verification date: 2026-09-11.

## Legend

| Class | Meaning |
| --- | --- |
| **P** | Primary — the artefact itself was fetched and read in this environment |
| **S** | Secondary — the primary source is unreachable here; the statement rests on search-result summaries and cross-references |
| **U** | Unverified — asserted in the repository; no source available here could confirm it |

## P · Verified against the primary artefact

### swiyu Swiss Profiles 1.0

The four profiles (`anchor`, `issuance`, `verification`, `vc`) were cloned from
the public specification repository and re-cloned a second time to rule out a
stale working copy; both clones resolved to the same commit, `91f09f1`.

A checking script compared every pinned value in
`packages/swiyu/src/profile.ts` and every rule row in
[`spec-conformance.md`](spec-conformance.md) against the profile text:

| Checked | Result |
| --- | --- |
| Profile version strings, spec version pins | 65 items compared |
| Cryptography (ES256, P-256, ECDH-ES, sha-256) | match |
| JOSE `typ` values, wallet deeplink scheme | match |
| Numeric limits (batch size, field lengths, status list bits) | match |
| Token status types and protected claim names | match |
| Sandbox hostnames and trust-anchor DIDs | match |
| 17 rules stated as "NOT SUPPORTED" or "MUST" | match |
| **Mismatches** | **0** |

Two limits differ between layers and the stricter one is enforced: the verifier
management API accepts a `purpose_name` up to 50 characters, the Trust Registry
caps the same field at 40 in a vqPS entry, and this project enforces 40.

### openEHR archetypes

Every archetype identifier and node name used in a claim binding was checked
against the published ADL in the openEHR Clinical Knowledge Manager mirror
(`github.com/openEHR/CKM-mirror`), cloned and read here. The pinned list lives
in `packages/swiyu/test/semantics.test.ts`, so a typo now fails the test run.

| Archetype | Nodes bound | Exists in CKM |
| --- | --- | --- |
| `openEHR-EHR-ACTION.medication.v1` | Medication item, Medication management, Route | yes |
| `openEHR-EHR-CLUSTER.medication.v2` | Batch ID, Name | yes |
| `openEHR-EHR-INSTRUCTION.medication_order.v3` | Medication item, Overall directions description, Dispense amount | yes |
| `openEHR-EHR-OBSERVATION.laboratory_test_result.v1` | Test name, Conclusion | yes |
| `openEHR-EHR-CLUSTER.laboratory_test_analyte.v1` | Analyte name, Analyte result, Reference range guidance | yes |
| `openEHR-EHR-CLUSTER.specimen.v1` | Collection date/time | yes |

This check found and corrected six wrong bindings. `lot_number` had been bound
to a `batch_id` node directly on `ACTION.medication.v1`, which has no such node
— Batch ID lives in `CLUSTER.medication.v2`, slotted into the action's
"Medication details". The dosage instruction had been bound to a
"Dose description" node that `INSTRUCTION.medication_order.v3` does not define
(the free-text node is "Overall directions description"), the dispense quantity
to an "Amount" node it does not define either ("Dispense amount"), and the three
laboratory analyte claims to an `analyte_result` group that belongs to
`CLUSTER.laboratory_test_analyte.v1`, one level down from the observation entry.

All six were plausible-looking and all six were wrong. A flat path is
template-specific and this project publishes no operational template, so a flat
path on its own is unfalsifiable — which is why the bindings now carry the
archetype and the CKM node name as well, and why the test pins them.

The `templateId` values (`DIDAS.immunisation.v0` and siblings) are local names
for templates this project has not modelled. They are not CKM templates and are
not claimed to be. See [the roadmap](roadmap.md).

### GovTech Hackathon 2024 — project 1103

The project page itself is unreachable from this environment, but the team's own
repositories are public on GitHub and were cloned and read in full:

- `Abdagon/hackathon-2024-ssi-health` — the challenge text, the project
  documentation, the team, and `health-ssi-schema.md`, the logical schema.
- `Abdagon/health-ssi-2` — the follow-on architecture and the learnings log.
- `needToRoll/govTechHack24-ssi-health` — the implementation, including the
  credential payloads the wallet actually carried.
- `janesp/health-ssi`, `SSI-Solutions/vcms` — the origin repository and the
  credential management system used at the hackathon.

Confirmed from these primary artefacts:

| Statement | Source |
| --- | --- |
| Challenge owner Peter Janes, DIDAS Health working group lead | `Pitch-DIDAS-GovTech24.md` |
| Won the future-oriented category, GovTech Hackathon 2024 | same, with the award photographs |
| Patient "John Miller", Dr. Charles Brewster, «Universal Pharmacy» | same |
| QR check-in triggering a proof request for insurance and health information | same |
| Wallet held allergies and medication alongside the insurance card | same |
| Credential schemas derived from FHIR subsets | `health-ssi-schema.md` |
| Insurance proof modelled on `ch-core-patient`, keyed by AVS13 | same |
| Practitioner identified by GLN | same |
| SD-JWT chosen as the signature format | `health-ssi-2/README.md` |

Two findings from these repositories changed this project's content:

1. **The 2024 payloads coded medication with ATC** (`A02BC01` omeprazole,
   `N02BE01` paracetamol). This repository's prescription credential codes with
   GTIN, which is what a Swiss pharmacy dispenses against, and CH EMED carries
   both. The divergence is deliberate and had gone unstated; it is now noted in
   [`positioning.md`](positioning.md).
2. **The 2024 lineage's own learnings log records a pivot** away from treating
   verifiable credentials as the source of truth, toward referenced information,
   to accommodate other data sources. That is the same objection the openEHR
   showcase raises from the other direction, and it is discussed in
   [`positioning.md`](positioning.md).

The 2024 project's transition staging — document-oriented "EPD 1.0", structured
server-based "EPD 2.0", structured wallet-based "EPD 3.0" — is quoted from
`Pitch-DIDAS-GovTech24.md`.

### GovTech Hackathon 2026 — event framing

`github.com/swiss/govtech-hackathon-2026` was cloned and read: the hackathon ran
28–29 May 2026 at the FOITT in Zollikofen, organised by the DTI division of the
Federal Chancellery with BFH, with challenges published on
`govtech.digisus-lab.ch/event/2`.

## S · Secondary sources only

Every one of the following hosts answers 403 at this environment's egress
gateway, for direct fetch and for archive and text-extraction proxies alike:
`hack.opendata.ch`, `govtech.digisus-lab.ch`, `openehr.atlassian.net`,
`confluence.didas.ch`, `wiki.openehr.org`, `discourse.openehr.org`,
`openehr.org`, `specifications.openehr.org`, `fhir.ch`, `build.fhir.org`,
`i14y.admin.ch`, `www.bk.admin.ch`, `web.archive.org`, `archive.org`,
`eventornado.com`, `r.jina.ai`. Anonymous GitHub cloning and web search are the
only channels that work. `OpendataCH/hackopendata-archive` was cloned on the
chance that it mirrored the project pages; it does not contain project 1103.

So the following are recorded as reported by search-result summaries and
corroborated across more than one of them:

| Statement | Primary source, unreachable |
| --- | --- |
| GovTech Hackathon 2026 project 28 is the openEHR Switzerland "2026 Showcase Impf-Modul" | `govtech.digisus-lab.ch/project/28` |
| Its data flow is FHIR intake in CH VACD format → validation → persistence as an openEHR COMPOSITION in a clinical data repository, "not as a JSON blob" | `openehr.atlassian.net/.../3468427363` |
| openEHR Switzerland and HL7 Switzerland have formed a joint working group to turn that showcase into a reusable implementation blueprint | `openehr.org/from-proof-of-concept-to-a-reusable-blueprint/` |
| Its scope: clinical models, terminology bindings, mapping artefacts, demographic references, transformation logic, orchestration, architectural patterns | same |
| Its architecture: FHIR façade, orchestration and transformation services, an openEHR CDR, and a FHIR-based demographic server, with FHIRconnect/openFHIR for bidirectional mapping | same |
| It is positioned as extensible to further clinical domains and to SwissHDS | same |
| CH VACD is legally mandated for use within the Swiss EPR | `fhir.ch/ig/ch-vacd/` |
| The 2026-09-08 Joint Working Group plenum | `openehr.atlassian.net/.../3996811327` |

The plenum page in particular returned nothing in search beyond its existence.
Nothing in this repository depends on its content; where the Joint Working Group
is referenced, it is on the strength of the published blueprint announcement.

FHIRconnect and openFHIR themselves are better attested — the specification is
on GitHub (`openFHIR/openfhir`) and described in arXiv:2511.14618 — but this
repository does not implement them, so they are cited as context only.

The IPS section codes used in [the roadmap](roadmap.md) (Allergies 48765-2,
Medications 10160-0, Problems 11450-4, Procedures 47519-4, Immunizations
11369-6, Results 30954-2, Devices 46264-8) were read from `deak-ai/healthwallet-ips`,
the DIDAS lineage's own open-source IPS wallet, and are primary to that
repository but secondary to the IPS specification, which is unreachable here.

## U · Asserted, and unverified here

These are the statements to have a lawyer read before this material is reused.
They are stated in the repository as though settled; they are not, and no source
available in this environment could confirm them.

| Assertion | Where it appears |
| --- | --- |
| KVG/LAMal Art. 42a as the insurer's basis for issuing the insurance card | `governance-framework.md`, `insurance-card.ts` |
| OR Art. 958f as the source of the ten-year business-record retention period | `governance-framework.md`, `insurance-card.ts`, `F-04` |
| MedBG/LPMéd as restricting prescribing to registered practitioners | `governance-framework.md`, `prescription.ts`, `F-05` |
| EpG/LEp plus cantonal authorisation as the basis for administering a vaccination | `governance-framework.md`, `immunization.ts`, `F-02` |
| A laboratory's authorisation deriving from the KVG analysis list | `governance-framework.md`, `lab-report.ts` |

The same caution applies to the healthcare retention periods used in the
governance policies, and to the claim that a practice may retain what it
verified at check-in. These are modelled as policy, and the policy is
configurable, and the citations are the project's own reading.

Two further categories are unverified for a different reason — no source could
settle them, because they are about this code:

- **Nothing here has run against the live swiyu Sandbox.** Every conformance
  rule is enforced against the profile text. No server has accepted or rejected
  one of these requests. The onboarding script was verified against the real DID
  Toolbox, which found three real bugs; the issuance and verification paths have
  not had the equivalent.
- **Illustrative codes are illustrative.** SNOMED CT vaccine codes, GLNs, BAG
  numbers, GTINs and LOINC codes in demo data are plausible and are not real. A
  deployment must take them from the terminology server. The schemas constrain
  their shape and can say nothing about their truth.
