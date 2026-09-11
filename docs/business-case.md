# The business case

Who pays, who benefits, and why 2026 is the moment to do it.

## The problem, stated without the technology

A Swiss patient's health record exists in fragments held by organisations that
do not talk to each other, and the patient is the only party present at every
one of those encounters — yet the one party with no usable copy.

The consequences are ordinary and expensive:

- **Vaccination status is unknowable in practice.** A GP, a pharmacy and a
  travel clinic each hold part of a patient's vaccination history. Asked "are
  you covered for tetanus?", most people guess. The clinical response to a guess
  is to vaccinate again.
- **Paper survives where platforms do not.** `meineimpfungen.ch` held the
  national electronic vaccination record until 2021, when it was shut down after
  serious security failures and several hundred thousand people lost access to
  their own history at once. The yellow booklet in a drawer is still the most
  reliable vaccination record in the country.
- **Every organisation re-collects the same data.** Name, date of birth,
  insurance cover and AHV number are re-keyed at every reception desk, from a
  plastic card that proves nothing.
- **Sharing is all-or-nothing.** A patient who wants to prove one fact hands
  over a document containing twenty.

## What actually changes

The record moves to the patient's wallet as verifiable credentials. Three
consequences follow that no amount of integration work delivers otherwise:

1. **The record outlives its issuers.** A practice that closes, a platform that
   is wound up, a canton that changes supplier — none of it removes the
   patient's copy.
2. **A narrow question gets a narrow answer.** A travel clinic asking about
   protection receives four claims out of the eighteen an immunization
   credential holds. The other fourteen are never transmitted.
3. **There is no honeypot.** No database holds everyone's vaccination history,
   so no breach exposes it. The only shared infrastructure is a status list of
   bits, carrying no patient data at all.

## What each party gets

| Party | What they get | What it costs them |
| --- | --- | --- |
| **Patient** | A vaccination record they keep and can prove anywhere; the ability to answer one question without disclosing twenty | Installing a wallet; understanding a consent screen |
| **Practice** | Identity and cover confirmed at check-in against two independent issuers, so a name mismatch surfaces; no re-keying; results handed over once | Integration with its practice management system; a DID and its onboarding |
| **Pharmacy** | A prescription that can be verified and used up exactly once, without a central e-prescription register | A verifier deployment; a DID |
| **Insurer** | Card data that can be revoked the day cover ends, in place of a plastic card that stays in circulation for years | An issuer deployment; a DID |
| **Laboratory** | Results delivered to the patient without operating a portal | An issuer deployment |
| **Public health** | A coverage survey that reads structured, signed, already-coded records instead of photocopied booklets | Loses the ability to enumerate susceptible individuals for outbreak response or recall (see below) |
| **Confederation / cantons** | A health use case on infrastructure already being built for the e-ID; no new register to fund, secure or defend | Standing up a health-domain governance body — the real cost, and the real blocker |

## What it costs to run

Deliberately modest, and worth being concrete since the usual objection is that
trust infrastructure is expensive:

- **Per DID**: chargeable by the Base Registry. A four-actor pilot needs four;
  the immunization showcase alone needs two.
- **Per actor**: one `swiyu-issuer` and/or `swiyu-verifier` container plus a
  Postgres, reachable over https. Small.
- **Integration**: the business application talks to two management APIs. It
  does not implement OpenID4VCI, DPoP, SD-JWT, encryption, DID resolution or
  status lists — the Confederation's generic components do all of that.
- **No registry to build.** The largest line item in the centralised version of
  this project does not exist here.

## Why 2026

Three things line up, and they will not line up again for some years:

1. **The e-ID arrives.** From go-live every resident can hold a
   Confederation-issued identity credential. Health is the use case with the
   clearest need for exactly that primitive.
2. **The infrastructure is already funded and built.** The Base Registry, Trust
   Registry, generic issuer and verifier exist and are operated by FOITT. A
   health use case is an application on top of them.
3. **The models are settled enough.** openEHR and HL7 FHIR give the clinical
   content; the openEHR/HL7 joint working group is converging the two, and
   diverging. Reusing them costs nothing and buys interoperability.

The opposite of acting now is not "wait and see". It is watching the sector
build another central register because nothing else was demonstrably ready.

## How adoption could actually start

Nothing here requires the whole sector to move at once, which is the usual
reason health interoperability projects stall.

1. **One practice and one travel clinic.** Two DIDs. The practice issues; the
   travel clinic verifies. Neither needs the other's software. This is the
   showcase in this repository.
2. **Add a pharmacy.** The prescription flow, with redemption by revocation.
   Still no central component.
3. **Add an insurer.** Check-in against real cover.
4. **Add credential types** while the participants stay as they are: allergies,
   problems, medication statements — the International Patient Summary set
   (roadmap step 2).

Each step is independently useful. A patient holding only immunization
credentials still gets the travel clinic benefit. There is no threshold below
which the system does nothing, which is the property network-effect projects
usually lack.

## What this does not solve, and should not claim to

- **Targeting named individuals.** Coverage *measurement* survives: the Swiss
  National Vaccination Coverage Survey samples households and reads the record
  the family holds, so it never depended on a central register. What a
  decentralised record removes is the ability to enumerate the susceptible —
  outbreak response, recall and catch-up campaigns. See
  [the public health view](public-health.md).
- **Patients without a smartphone.** Every flow must degrade to the existing
  paper or plastic path without making those patients second-class. That is a
  service-design problem this repository does not answer.
- **Emergency access.** A patient who is unconscious cannot consent. Any
  break-glass mechanism reintroduces a party who can read the record without
  them — the exact property this design exists to avoid. Unsolved, and the
  hardest question in the architecture.
- **Clinical decision support.** "Protected against X" is an inference from
  dose, schedule and elapsed time. The credential carries facts; somebody still
  has to be accountable for the inference.

## The risk that actually matters

Not technical. **No health-domain governance body exists** to say "this DID is a
practice authorised to vaccinate". Until one does, verification falls back to
explicitly listed issuer DIDs — workable for a pilot, unworkable at scale.

The technology is ready some distance ahead of the institutional arrangements.
That is this project's main finding, and the decision it puts in front of the
sector.
