# The public health view

Everything else in this repository looks at one patient at a time: a dose, a
consultation, a presentation at a counter. Public health asks a different
question — what is true of the population — and that question is where a
wallet-held record is usually assumed to fail.

The assumption is worth checking, because on the central point it turns out to
be wrong.

## Switzerland does not measure vaccination coverage from a register

The national figure comes from the **Swiss National Vaccination Coverage
Survey**, running since 1999, coordinated by the Epidemiology, Biostatistics and
Prevention Institute at the University of Zurich with the Federal Office of
Public Health and all 26 cantons. Its method:

- children aged **2, 8 and 16**
- **randomly selected households**, invited by letter
- families **submit a copy of the child's vaccination record**
- a **three-year rolling cycle**, roughly a third of the cantons each year

So the instrument is a sample, and the data source is *the record the family
holds*. Coverage monitoring has never depended on a central database. When
`meineimpfungen.ch` closed in 2021, the coverage survey carried on, because the
survey was never reading from it.

This repository currently says that a decentralised record "does not produce
coverage statistics as a side effect". That is true and it implies something
false — that a central register was producing them. It was not. The sentence
should say what is actually lost, which is narrower and sharper.

## What a credential would do for that survey

The survey's data collection is a household posting a photocopy of a paper
booklet, followed by manual transcription and coding. Families are contacted up
to three times, by post and telephone.

A vaccination credential is the same record, held in the same place, in a form
that removes most of that work:

| Survey problem today | What a credential changes |
| --- | --- |
| Handwriting, faded stamps, missing booklets | Structured claims, bound to CH VACD element paths |
| No way to tell a transcription error from a real gap | The issuer signed it; provenance travels with the data |
| Manual coding to SNOMED for analysis | Already coded — `vaccine_code` and `target_disease` are SNOMED CT |
| Consent handled per study, on paper | Selective disclosure: the survey asks for the four claims it needs and gets nothing else |

A survey participant presenting credentials would be releasing *less* than a
photocopy of a booklet discloses today, and the receiving analyst would get
something machine-readable. F-09 already models the entitlement shape that makes
this possible.

None of this is built. It is the most concrete public-health use of the
architecture and it is not on the roadmap, which is an argument for putting it
there.

## What is genuinely lost

Not the statistics. **The ability to act on named individuals.**

- **Outbreak response.** A measles case in a school means finding who around
  them is susceptible, now. A sample gives a rate; a wallet gives nothing
  queryable. A register would give a list — and this design cannot.
- **Recall and catch-up.** Reminding the people who are behind on a series
  requires knowing who they are. The credential holder is the only party who
  can be reminded, and only if something reminds them.
- **Sub-population denominators.** Coverage by canton, by age band, by
  socioeconomic stratum needs a denominator the survey supplies by construction
  and a decentralised record cannot.

These are real losses, and they follow from the design instead of being gaps
to close later. Deciding whether the population can live with them is a policy
question; no amount of engineering answers it.

Stated plainly: this architecture is compatible with **measuring** population
health and incompatible with **targeting** individuals within it.
Whether that trade is acceptable depends on how much the second matters, and in
an outbreak it matters a great deal.

## Equity is a public health question

The business case files "patients without a smartphone" under things this
project does not solve. From a public health view that filing is wrong: it is
not a usability footnote, it is a question about who the system works for.

A wallet-first design assumes a smartphone, a working knowledge of what a
credential is, the capacity to manage one's own records over decades, and
enough digital confidence to consent under time pressure at a counter. The
populations least likely to have all four — the very old, people with cognitive
decline, people without stable housing, recent arrivals, the digitally
excluded — overlap substantially with the populations with the worst
vaccination coverage.

The survey's own method is the evidence that the paper path has to persist:
it asks families to **post a copy**, in 2026, because that is what reliably
reaches everyone. Every flow here must degrade to that path without making
those patients second-class, and this repository demonstrates none of that.

## "Complete series" is defined by the vaccination plan

F-03 records that "protected against X" is an inference the verifier draws,
and treats it as a clinical-safety question. The public-health framing is that
the inference has an author: the **Swiss vaccination plan**, issued by the FOPH
with the Federal Commission for Vaccination Questions (EKIF), is what defines
what a complete series is, and it changes.

The standards already carry this. CH VACD publishes:

- `ch-vacd-ch-vaccination-plan-immunizations-vs` — "immunization procedures for
  recommendations according to the vaccination plan", bound to SNOMED CT
- `ch-vacd-recommendation-forecast-status-vs` — `due`, `overdue`, `immune`,
  `indicated`, `contraindicated`, `consultadvise`
- a recommendation request/response message pair, so the judgement can be asked
  of one service instead of reimplemented per verifier

That last one matters here. A travel clinic deciding "complete" from four
disclosed claims is reimplementing the vaccination plan in a verifier, which is
exactly how two verifiers come to disagree about the same patient. The
recommendation service is the modelled answer and this project does not use it.

## Consent-based secondary use is not surveillance, and the reason is methodological

F-09 says this. Here is why, since the reason is the useful part.

A consent-based contribution produces a **self-selected sample**. People who
consent to share health data differ systematically from those who do not — in
health literacy, in trust in institutions, in health status. For a prevalence
estimate that bias is not noise to be averaged away; it moves the estimate in a
direction you cannot measure from inside the sample. The coverage survey
handles this with random selection and up to three contact attempts, which is
work done precisely to stop the sample selecting itself.

So F-09 is a mechanism for **research with consent**, and it does not become
surveillance by scaling up. The two answer different questions and need
different sampling.

## What SSPH+ could do with this

An inter-university public health faculty is the right place for several of
these to be settled, and none of them are engineering:

1. **Test the survey substitution.** Run the coverage survey's data collection
   against credentials in one canton's cycle alongside the existing paper
   method, and measure what changes — response rate, transcription error, cost,
   and whether the sample shifts.
2. **Quantify the equity gap** before it is designed in. Who cannot hold a
   credential, how does that overlap with existing coverage gaps, and what does
   the fallback path have to guarantee.
3. **Put a number on the targeting loss.** What does outbreak response actually
   cost when the susceptible cannot be enumerated, compared with a canton that
   can? That is an answerable question and it is the strongest argument either
   way.
4. **Decide whether the vaccination plan belongs in a service.** If verifiers
   each infer "complete" locally, they will disagree. Whether that is tolerable
   is a clinical-governance judgement.

## Status of this document

An argument. Nothing described here as a possibility is built. The survey method, the CH VACD value sets and the SSPH+ structure were
checked against published sources; see [source
verification](source-verification.md) for how that distinction is kept in this
repository.
