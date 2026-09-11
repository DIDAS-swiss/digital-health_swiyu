# The public health view

Everything else in this repository looks at one patient at a time: a dose, a
consultation, a presentation at a counter. Public health asks what is true of a
population, and a wallet-held record is commonly assumed to fail at that.

This document checks the assumption. On the central point — whether coverage can
still be measured — it does not hold. On a second point — whether individuals can
still be acted on — it does.

## Switzerland does not measure vaccination coverage from a register

The national figure comes from the **Swiss National Vaccination Coverage
Survey**, running since 1999, coordinated by the **Epidemiology, Biostatistics
and Prevention Institute (EBPI)** at the University of Zurich with the Federal
Office of Public Health and all 26 cantons. Its method:

- children aged **2, 8 and 16**
- **randomly selected households**, invited by letter
- families **submit a copy of the child's vaccination record**
- a **three-year rolling cycle**, roughly a third of the cantons each year

So the instrument is a sample, and the data source is *the record the family
holds*. Coverage monitoring has never depended on a central database. When
`meineimpfungen.ch` closed in 2021, the coverage survey carried on, because the
survey was never reading from it.

A decentralised record does not produce coverage statistics as a side effect.
That statement is true, and it carries a false implication: that a central
register was producing them. No Swiss register was. What is actually lost is
narrower, and the section below states it.

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

This is now specified as [F-11](../flows/F-11-coverage-survey.md), with the
entitlement defined on the immunization credential under a `statistics` role
distinct from `research`. Nothing beyond the entitlement is built.

The constraint that makes or breaks it: **the wallet is a response channel and
never a sampling frame.** EBPI draws the sample from the population register,
which is what keeps the estimate unbiased and also why the credential needs to
carry no demographic claim at all — the frame already has the age and the
canton.

## What is genuinely lost

What is lost is **the ability to act on named individuals**, not the ability to
measure the population.

- **Outbreak response.** A measles case in a school means finding who around
  them is susceptible, now. A sample gives a rate; a wallet gives nothing
  queryable. A register would give a list — and this design cannot.
- **Recall and catch-up.** Reminding the people who are behind on a series
  requires knowing who they are. The credential holder is the only party who
  can be reminded, and only if something reminds them.
- **Sub-population denominators.** Coverage by canton, by age band, by
  socioeconomic stratum needs a denominator the survey supplies by construction
  and a decentralised record cannot.

These losses follow from the design and are not gaps that later work closes.
Whether the population can accept them is a policy question, and engineering
does not answer it.

Summarised: this architecture supports **measuring** population health and does
not support **targeting** individuals within it. How acceptable that is depends
on how much the second capability is worth, and during an outbreak it is worth a
great deal.

## Equity is a public health question

The business case lists "patients without a smartphone" among the things this
project does not solve, which treats the matter as a usability limitation. From
a public health view it is a question about who the system works for, and it
belongs with the other population-level questions in this document.

A wallet-first design assumes a smartphone, a working knowledge of what a
credential is, the capacity to manage one's own records over decades, and
enough digital confidence to consent under time pressure at a counter. The
populations least likely to have all four — the very old, people with cognitive
decline, people without stable housing, recent arrivals, the digitally
excluded — overlap substantially with the populations with the worst
vaccination coverage.

The survey's own method is evidence that the paper path has to persist: it asks
families to **post a copy**, in 2026, because that is what reliably reaches
everyone. Every flow here has to degrade to that path without placing those
patients at a disadvantage, and this repository demonstrates no such fallback.

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

F-09 states this. The reasoning is as follows.

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
3. **Put a number on the targeting loss.** What does outbreak response cost when
   the susceptible cannot be enumerated, compared with a canton that can
   enumerate them? The question is answerable empirically, and the answer bears
   directly on whether the design is acceptable.
4. **Decide whether the vaccination plan belongs in a service.** If verifiers
   each infer "complete" locally, they will disagree. Whether that is tolerable
   is a clinical-governance judgement.

## Status of this document

This document is an argument, not a specification. Nothing described here as a
possibility is built. The survey method, the CH VACD value sets and the SSPH+
structure were checked against published sources; see
[source verification](source-verification.md) for how the repository separates
verified facts from claims made in argument.
