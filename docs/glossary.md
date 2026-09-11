# Glossary

Swiss administrative, verifiable-credential and clinical-informatics vocabulary
collide in this project. This is the minimum needed to read the rest.

## The trust infrastructure

**swiyu** — the Swiss trust infrastructure operated by FOITT, on which the e-ID
is built. Not itself the e-ID.

**Sandbox** — the test environment, renamed from "Public Beta" by change dossier
CD-001 and strictly separated from production. Hosts carry `swiyu-int`. Needs
its own wallet; the production swiyu Wallet refuses Sandbox credentials.

**Base Registry** — publishes DID documents and status lists. The only shared
infrastructure this project touches, and it holds no patient data.

**Trust Registry** — publishes trust statements about actors: who they are, what
they are entitled to do, what they say they ask for.

**Generic issuer / verifier** — `swiyu-issuer` and `swiyu-verifier`, the
Confederation's reference implementations. Each actor runs its own instance.
They carry the protocol so business applications don't have to.

**Beta-ID** — the Sandbox stand-in for the e-ID, carrying the attribute set of
Art. 15 BGEID. Free from the Beta Credential Service. Self-declared data.

**Swiss Profile** — the Confederation's narrowing of the international
specifications. Four of them: `anchor` (identifiers), `issuance`, `verification`,
`vc` (credential format). Version 1.0 throughout this project.

**Change dossier (CD)** — a published breaking or notable change to the
infrastructure. CD-001 separated Sandbox from production; CD-006 introduced
Trust Protocol 2.0.

## Credentials

**Verifiable credential (VC)** — a set of claims, signed by an issuer, held by
the subject, presentable to a verifier without contacting the issuer.

**Issuer / holder / verifier** — who asserts, who keeps, who asks. The three
roles of the model. A practice is an issuer of prescriptions and a verifier of
insurance cards.

**SD-JWT VC** — the credential format. Each claim is individually disclosable,
which is what makes a four-claim answer to an eighteen-claim credential possible.

**`vct`** — verifiable credential type. Identifies what a credential *is*. This
project uses stable URNs (`urn:vct:ch.didas.health.immunization:1.0`) so issued
credentials keep their meaning when a deployment moves host.

**Selective disclosure** — releasing some claims and not others. Not redaction
after the fact: undisclosed claims are never transmitted.

**Key binding** — proof that the wallet presenting a credential holds the key it
was issued to. Without it a credential is a bearer token.

**Status list / Token Status List** — a public bit array saying whether a
credential is still valid. Two bits per credential support both revocation and
suspension. Carries nothing else — no patient, no medication, no verifier.

**`exp` vs `expiry_date`** — `exp` is absolute: past it a credential cannot be
presented. `expiry_date` is a business fact that warns the holder and leaves the
decision to the verifier. An expired e-ID is still adequate proof of being over
18; collapsing the two removes that judgement.

## Protocols

**OpenID4VCI** — how a credential gets into a wallet. This project uses only the
pre-authorized code flow: a QR code carries the offer.

**OpenID4VP** — how a wallet presents a credential to a verifier.

**DCQL** — the query language a verifier uses to say which credential and which
claims it wants. The list in a DCQL query *is* the minimisation decision.

**JAR** — JWT-Secured Authorization Request. The verifier signs its request, so
a wallet can tell who is asking before showing a consent screen.

**DPoP** — proves the party using an access token is the one it was issued to.
Mandatory throughout issuance in the Swiss Profile.

**`direct_post.jwt`** — the response mode the profile requires: the presentation
is always encrypted.

## Identity and trust

**DID** — a decentralised identifier. An actor's public identity, resolvable to
its keys without a certificate authority.

**`did:webvh`** — the DID method the Swiss Profile requires. Formerly spelled
`did:tdw`; CD-001 requires new DIDs to use the new name.

**DID log** — the append-only history of a DID document, each entry signed with
the *update key*. Lose that key and the DID can never be changed again.

**Proof of possession (PoP)** — a JWT signed with a DID's private key proving
control of it. How the Trust Registry verifies an onboarding.

**Trust marker** — a machine-readable statement about an actor:

| Marker | Says |
| --- | --- |
| `viTM` | Verified Identity — the Confederation checked who this is |
| `caTM` | Compliant Actor |
| `gucTM` | This is a governed use case |
| `gucaTM` | This actor is authorised for that governed use case |

**Protected field** — a claim requiring explicit authorisation to request,
whatever credential carries it. In Switzerland: the AHV number.

**vqPS** — Verification Query Public Statement. A verifier publishing what it
asks for and why. Self-service, available today.

## Swiss health administration

**AHV / AVS number** — the 13-digit social security number (`756.xxxx.xxxx.xx`).
A lifelong cross-sector identifier, which is why it is a protected field. In
credentials it appears as `personal_administrative_number`.

**KVG / LAMal** — the mandatory health insurance act. **VVG** is supplementary
cover; **UVG** is accident insurance.

**VeKa** — the insurance card, and the 20-digit number printed on it. Identifies
the card, not the person.

**BAG / OFSP** — the Federal Office of Public Health. Insurers carry a BAG
registration number.

**GLN** — Global Location Number, the 13-digit identifier for Swiss health
professionals and organisations, held in the Refdata index.

**MedReg** — the federal register of medical professionals.

**EpG / LEp** — the epidemics act, under which vaccination is authorised.

**MedBG / LPMéd** — the medical professions act: only a registered practitioner
may prescribe.

**EPD / DEP** — the Swiss electronic patient record. The incumbent. In a
decentralised design it becomes one issuer among others rather than the
destination.

**`meineimpfungen.ch`** — the national electronic vaccination record, shut down
in 2021 after serious security failures. The failure this project is a response
to.

## Clinical models

**openEHR** — an approach to clinical information modelling based on
*archetypes* (reusable clinical concepts) and *templates* (their use in a
context). Usually deployed with a central clinical data repository; this project
reuses the models and declines the repository.

**Archetype** — e.g. `openEHR-EHR-OBSERVATION.laboratory_test_result.v1`.

**Flat format** — an openEHR composition as template-path-to-value pairs, with
`:n` indices on repeating nodes. What a CDR's flat endpoint accepts.

**HL7 FHIR** — the interoperability standard most health systems already speak.
Data is *resources*: `Immunization`, `MedicationRequest`, `Observation`,
`Coverage`.

**Profile** — a constrained FHIR resource for a context. **CH VACD** covers
vaccination data, **CH EMED** medication, **CH Core** the basics.

**IPS** — International Patient Summary. The minimum dataset for unplanned care:
allergies, medication, problems, immunizations. Roadmap step 2.

**LOINC** — codes for laboratory analytes. **SNOMED CT** — clinical concepts
including vaccines and diseases. **UCUM** — units. **GTIN** — medication packs.

**CDR** — clinical data repository. The thing this project deliberately does not
build.

## This project

**Actor** — one organisation with one DID. Four of them: insurer, practice,
pharmacy, travel clinic.

**Role** — a registered capability. One actor holds several; a practice is also
a vaccinator and a laboratory.

**Entitlement** — which claims a role may request from a credential type. The
ceiling, enforced when the query is built.

**Gate** — one of the three governance checks: `reviewIssuance`,
`reviewRequest`, `reviewPresentation`.

**Journal** — the audit record. Claim names, never values.

**Projection** — a FHIR resource or openEHR composition rebuilt locally from
disclosed claims. Derived, never authoritative; legitimately partial.

**Flow** — a documented interaction in [`flows/`](../flows/README.md), with its
governance and standardisation constraints and its open questions. The blueprint.
