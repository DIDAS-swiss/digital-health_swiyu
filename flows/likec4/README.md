# The health flows as C4

`health-flow.likec4` models the health trust domain in [LikeC4](https://likec4.dev):
who holds which role, what each may issue or ask for, and how a vaccination
record travels from the practice that administered it to the travel clinic that
needs to know the series is complete.

The model is the same material as the [flow documents](../README.md) in a form
that can be rendered, navigated and diffed. The flow documents carry the
governance constraints, the standardisation constraints and the open questions;
the model carries the shape.

## Why LikeC4 and not a drawing

The [DIDAS Trust Flow Diagram
Repository](https://github.com/DIDAS-swiss/Trust-Flow-Diagram-Repository) models
its reference flow this way, and matching it means these flows can move there
without being redrawn. Diagrams-as-code also fails loudly: a view that
references an element it never includes is a build error. A drawing in the same
state stays a picture, and quietly stops matching the system.

That is why `npm run flows:check` runs in CI. It validates the model **and**
exports every view, because validation alone parses the syntax while the export
computes each view and catches the second kind of mistake.

## Views

| View | Flow | What it shows |
| --- | --- | --- |
| `index` | — | The landscape: patient, four care providers, the governance body, the federal trust infrastructure, and the EPD |
| `trustInfrastructureDetail` | — | Base Registry and Trust Registry, and who talks to which |
| `actorOnboarding` | [F-01](../F-01-actor-onboarding.md) | DID publication, identity verification, the role grant that has no body to grant it, and the vqPS |
| `immunizationIssuance` | [F-02](../F-02-immunization-issuance.md) | Status list, the issuance gate, the offer, the metadata fetch, the credential |
| `protectionCheck` | [F-03](../F-03-immunization-minimal-disclosure.md) | Four claims of eighteen, with the consent moment and the decline branch |
| `practiceCheckIn` | [F-04](../F-04-practice-check-in.md) | Two DCQL queries in one request, and the protected AHV number |
| `prescriptionRedemption` | [F-05](../F-05-prescription-redemption.md) | Presentation, then revocation by the original issuer |
| `correction` | [F-06](../F-06-lifecycle-and-correction.md) | Revoke, supersede using the CH VACD `relatesTo` shape, and the holder notification that is missing |
| `coverageSurvey` | [F-11](../F-11-coverage-survey.md) | The EBPI coverage survey: sample drawn from the population register, five claims disclosed, no identifier |

Each step's title reads as an action and its `notes` carry the protocol, the
format, and the eHealth Suisse or Swiss Profile rule behind it. The diagram
stays readable and the detail is one click away — the convention the reference
model set.

## Rendering it

```bash
npm run flows:dev      # local server with live reload
npm run flows:check    # validate and compute every view, as CI does
npm run flows:build    # static site into site/flows/
```

`dynamic view`s render as flow diagrams by default. The sequence rendering with
lifelines is a variant: toggle it in the preview, or pass `--sequence` to
`likec4 export`.

The published portal builds `site/flows/` at publish time, so the generated
bundle is never committed.

## What is modelled here and what is not

The generic mechanics — how a DID is published, how a token is obtained, how a
signature is checked — belong to the reference model's `basic-flow` and are
referenced here and repeated nowhere. [`../trust-flow-basis.md`](../trust-flow-basis.md)
maps every step and names the three the reference model has no shape for.

F-07 to F-10 have no views here. F-07 happens inside a relying party after a
presentation, F-08 and F-09 are compositions of `protectionCheck` across more
credential types, and F-10 is roadmap step 3 with an unresolved question about
who authors a machine-generated claim. Modelling them now would draw a system
that does not exist.
