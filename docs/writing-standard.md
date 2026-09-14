# Writing standard

The intended readers of this repository are government, standards bodies,
architects, protocol engineers, healthcare professionals and regulators. The
prose is written to be read literally by them and to remain defensible when it
is.

This document defines the standing editorial rule. The automated review gate
records reviewed sentences in `scripts/articulation-accepted.json`.

`npm run check:articulation` is a **review gate, not semantic validation**. It
finds sentences that use a watched word without the surrounding precision and
requires that a person has read each one. It cannot tell whether a statement is
true, whether the actor named is the one that acts, or whether a conclusion
follows from the mechanism. CI green means every candidate sentence has been
read and recorded. It does not mean the prose is correct, and it is not a
substitute for review against the rules below.

The record carries the version of this document it was made against. Changing
this document in a way that could make an accepted sentence unacceptable
requires bumping `STANDARD_VERSION` in the checker, which reopens the record for
re-reading. An acceptance also lapses on its own when the sentence starts
tripping a rule that did not exist when it was accepted.

## What this is not

Not a blog post, a product page, an advocacy paper, a conversational explainer
or marketing copy.

## 1 · Say what the component does

Every sentence should state what the architecture, protocol, component, actor or
implementation does. A technical property is not a human, legal, business,
privacy or security conclusion, and does not become one without a separate
justification.

| Write | Rather than |
| --- | --- |
| the presentation contains four disclosed claims | the verifier learns only what it needs |
| the verifier evaluates the credential status entry | the credential is valid |
| the wallet requires the holder to approve the presentation | the holder gives consent |
| the issuer is not contacted during this status check | the issuer learns nothing |

## 2 · No rhetorical shorthand

Formulations of this kind are removed unless they are literally and
demonstrably true: *the root the whole system hangs from*, *the credential
outlives its issuer*, *nothing else connects the two*, *trust runs both ways*,
*the rest stay on the phone*, *the same person*, *proves protection*, *the
system knows*, *the architecture guarantees*, *cannot happen*, *always*,
*never*.

Removal is not substitution. Rewrite the underlying proposition precisely rather
than swapping the phrase for a milder one.

## 3 · No promotional adjectives

*Secure*, *privacy-preserving*, *trusted*, *robust*, *seamless*, *powerful*,
*innovative*, *resilient* and *interoperable* are used only where the text
defines the property or cites its basis.

Write "a presentation using selective disclosure in which the specified
undisclosed claim values are omitted" rather than "a privacy-preserving
presentation".

## 4 · Name the actor and the mechanism

Not *the system checks*, *the infrastructure decides*, *trust is established*.

Write *the verifier checks*, *the wallet evaluates*, *the issuer signs*, *the
policy layer rejects*, *the Trust Registry provides*, *the relying organisation
determines*.

## 5 · Preserve these distinctions

Do not collapse:

- verification and acceptance
- signature validity and factual truth
- issuer identity and issuer authorisation
- presentation approval and legal consent
- selective disclosure and anonymity
- selective disclosure and unlinkability
- credential status and overall credential validity
- verifier and relying party
- credential possession and business outcome
- technical capability and governance permission

Where a sentence crosses one of these boundaries, split it.

## 5a · Statements are published, markers are derived

Trust Protocol 2.0 has three layers and they are collapsed easily:

```
governing actor
      │ publishes
      ▼
applicable statements          Trust Statements, Trust List Statements,
      │                        Public Statements such as the vqPS
      │ validated and evaluated by an actor
      ▼
trust markers                  viTM, caTM, tvTM, gucTM, gucaTM,
      │                        derived for one relationship or interaction
      │ evaluated with local policy
      ▼
accept, refuse or continue
```

A trust marker is an **evaluation result**. It is not issued to a DID, not held
by an organisation, not a registry entry, not a credential, not a role grant and
not something a governing authority gives to an actor.

| Write | Rather than |
| --- | --- |
| The competent governing actor publishes the applicable authorisation statement. An actor that validates the applicable statements may derive `gucaTM` for that interaction | The health authority issues `gucaTM` to the practice |
| The trust evaluation returned `gucaTM` for the practice in this governed-use-case interaction | The practice holds `gucaTM` |
| The Trust Registry publishes and serves the applicable statements; markers are derived when an actor evaluates them | `gucaTM` is stored in the Trust Registry |
| The evaluating actor validates the applicable trust information obtained through the Trust Registry and applies the Trust Protocol and its policy | Trust is established by the registry |

Use the statement type the Trust Protocol defines where one applies: `piaTS` for
protected issuance authorisation, `pvaTS` for protected verification
authorisation, the applicable Trust List Statements, and `vqPS` for a published
verification query and purpose. Do not invent a field inside a statement type
that the protocol does not define.

An implementation object may still be called a marker where that is what it is.
`IssuerTrustMarker` in this repository is the generic verifier's evaluation
response for one interaction, and its documentation says so.

## 5b · Project vocabulary stays visibly project vocabulary

`ch.didas.health.role.*` is DIDAS governance vocabulary. It is not a Trust
Protocol role identifier, not a Trust Protocol claim and not a marker.

Write: a deployment may map the governance decision a role represents onto one
or more applicable Trust Protocol authorisation statements.

Do not write that the role is stored in the Trust Registry, or that a role
corresponds to `gucaTM`.

## 6 · Short exact sentences

Precision does not require dense prose. Three sentences that each state one
thing are preferred to one sentence combining request construction,
authorisation, disclosure and approval.

## 7 · No pedagogical filler

Remove *this is important because*, *what this means is*, *the key point here
is*, *this is the beauty of*. State the proposition.

## 8 · Architecture-neutral

The text does not imply that decentralised is inherently better than
centralised, that credentials inherently replace registries, that wallets
inherently improve privacy, that verifiable credentials inherently prevent
fraud, or that an architecture is superior because the demonstrator uses it.
Describe the property and its trade-offs.

## 9 · Strong words only where the source is strong

*MUST*, *SHOULD*, *MAY*, *required*, *prohibited*, *guaranteed* and *impossible*
are used only where a specification, a law or an enforced implementation
constraint supports them. Otherwise: *supports*, *permits*, *is designed to*,
*can*, *may*, *in this implementation*, *under the current profile*, *subject to
applicable policy*.

## 10 · Separate repository fact from external fact

Write *in this demonstrator*, *this repository models*, *the current Swiss
Profile requires*, *the BGEID provides*, *DIDAS proposes*.

A choice made in this demonstrator must not read as a swiyu requirement, and a
swiyu profile rule must not read as a general property of verifiable
credentials.

## The test applied to each sentence

1. What exact object is being described?
2. Which actor performs the action?
3. Which mechanism causes the result?
4. What conclusion is actually supported?
5. Does the wording imply anything stronger than that?

If the answer to 5 is yes, rewrite.
