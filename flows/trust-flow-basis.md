# What these flows reuse from the Trust Flow Diagram Repository

DIDAS maintains a [Trust Flow Diagram
Repository](https://github.com/DIDAS-swiss/Trust-Flow-Diagram-Repository) whose
`basic-flow/` is the reference model for the Swiss e-ID trust infrastructure:
registration, issuance and verification, modelled in LikeC4 and published as an
[interactive diagram](https://didas-swiss.github.io/Trust-Flow-Diagram-Repository/basic-flow/).
Its stated convention is that domain flows abstract those steps and point back
to it for the mechanics.

These flows follow that convention. This page records what was checked, so a
reader can see which of our steps are the reference flow under another name and
which are genuinely health-specific.

The mapping below was checked against `basic-flow/credential-flow.likec4` at
commit `4fba24d`, step by step.

## F-01 · Becoming an actor → `registration`

| Our step | Reference step | |
| --- | --- | --- |
| Generate keys, publish the `did:webvh` log to the Base Registry | `issuer -> baseRegistry` *Publish issuer key* | reused |
| Proof of possession to the Trust Registry | `issuer -> trustRegistry` *Apply for issuer accreditation* | reused |
| Trust statement returned, identity verified | `trustRegistry -> issuer` *Trust Statement issued* | reused |
| The verifier side of all three | the three `verifier ->` steps | reused |
| Publishing the verification query and its purpose (vqPS) | *defines what data he will request for which purpose*, in the verifier accreditation step | reused |
| Registering as a business partner on the Service Portal | — | added |
| A health governance body granting **role-scoped** authorisation (`gucaTM` per credential type) | — | **does not map** |

The reference model has one Trust Authority issuing one kind of statement:
"this DID belongs to this accredited organisation, and it may issue
credentials." Health needs a statement one level more specific — "this DID is a
practice authorised to vaccinate" — granted by a body that can check the
cantonal authorisation, the MedReg entry and the GLN, and it needs one
organisation to hold several such roles at once. Raised as
[Trust-Flow-Diagram-Repository#3](https://github.com/DIDAS-swiss/Trust-Flow-Diagram-Repository/issues/3).

## F-02 · Recording an administered dose → `issuance`

| Our step | Reference step | |
| --- | --- | --- |
| Credential offer as a QR code | `issuer -> holder` *Send credential offer (QR / link)* | reused |
| Wallet checks the issuer's accreditation | `holder -> trustRegistry` *Check the Issuer is accredited* | reused |
| Token request and response | `holder -> issuer` / `issuer -> holder` *access token* | reused |
| Credential request and issuance | *Request the credential* / *Issue the credential* | reused |
| Status list entry | `issuer -> baseRegistry` *Publish revocation status entry* | reused, reordered |
| The vaccinator's own identification of the patient | `holder -> issuer` *Verify identity* | reused |
| `reviewIssuance()` before an offer exists | — | added |
| Fetching Type Metadata and the OCA bundle over `vct_metadata_uri#integrity` | — | **does not map** |
| DPoP nonce, DPoP-bound token, key attestation | — | **does not map** |

Two orderings differ, and the Swiss Profile is what decides them, so they hold
for any swiyu use case. The reference model publishes the status entry after issuance;
`swiss-profile-issuance:1.0.0` requires the status list to exist first, because
the credential references it at creation. And between the offer and the token
request, a swiyu wallet fetches signed issuer metadata, then Type Metadata, then
the OCA bundle it renders the credential from — three steps with no counterpart
in the reference flow. Raised as
[Trust-Flow-Diagram-Repository#4](https://github.com/DIDAS-swiss/Trust-Flow-Diagram-Repository/issues/4).

## F-03 · Proving protection → `verification`

This one maps almost exactly, including the parts that are easy to leave out.

| Our step | Reference step | |
| --- | --- | --- |
| Signed request object naming the claim paths | `verifier -> holder` *Request proof of age (over 18)* | reused |
| Wallet resolves the verifier DID and checks the signature | `holder -> baseRegistry` *Check requester signature* | reused |
| Wallet checks the verifier's accreditation and its declared purpose | `holder -> trustRegistry` *checks if the requested data corresponds with the declared purpose* | reused |
| Encrypted response carrying only the entitled claims | `holder -> verifier` *Send proof (only "over 18")* | reused |
| Issuer signature, status list, issuer accreditation | the three closing `verifier ->` steps | reused |
| `reviewRequest()` before the query is built | — | added |
| The holder declining, as a recorded outcome | — | **does not map** |

The reference flow's age check *is* our disclosure case with a different claim
name, which is why F-03 describes what the travel clinic may ask for and leaves
the mechanics to the reference diagram.

The one gap is the holder saying no. Every step in the reference verification
view assumes consent is given; `client_rejected` is a first-class outcome of
OID4VP and the flow that a relying party is most likely to handle badly. Raised
as [Trust-Flow-Diagram-Repository#5](https://github.com/DIDAS-swiss/Trust-Flow-Diagram-Repository/issues/5).

## The remaining flows

F-04 through F-10 compose the three reference views, and add no protocol steps
of their own:

| Flow | Composition |
| --- | --- |
| F-04 check-in | two `verification` runs in one presentation request |
| F-05 prescription redemption | `verification`, then a status change by the original issuer |
| F-06 lifecycle and correction | the status-list step of `issuance`, on its own |
| F-07 model projection | after `verification`, inside the relying party |
| F-08 patient summary | many `verification` runs across credential types |
| F-09 secondary use | `verification` with an unusual verifier and a consent object |
| F-10 continuous data | `issuance`, with an open question about who authors the claim |

Where one of these needs a step the reference model has no shape for, the note
is in that flow's own **Standardisation constraints** section.
