# Integration guide

For a practice management system, pharmacy software or insurer back office that
wants to issue or verify credentials. Written against this repository's
`@didas/swiyu` package, but the API surface is the generic components' and is
the same from any language.

## What you integrate with — and what you don't

You talk to **two management APIs**, both HTTP and JSON:

```
swiyu-issuer      POST /management/api/status-list
                  POST /management/api/credentials
                  PATCH /management/api/credentials/{id}/status

swiyu-verifier    POST /management/api/verifications
                  GET  /management/api/verifications/{id}
```

You do **not** implement: OpenID4VCI, OpenID4VP, DPoP, key attestation,
application-layer encryption, signed issuer metadata, SD-JWT assembly and
disclosure handling, JAR signing, response decryption, key binding verification,
DID resolution, status list signing and publication, or trust marker evaluation.

That is the whole point of the generic components. It is also where conformance
is won or lost, and none of it belongs in a practice management system.

## Issuing a credential

```ts
import { IssuerManagementClient, IMMUNIZATION, reviewIssuance } from '@didas/swiyu';

const issuer = new IssuerManagementClient({ baseUrl: process.env.PRAXIS_ISSUER_URL });

// 1. Governance first: refuse before anything reaches the issuer.
const decision = reviewIssuance(IMMUNIZATION, myRoles);
if (decision.outcome === 'deny') throw new Error(decision.reasons.at(-1));

// 2. A status list, once per issuer. Immutable after initialisation.
//    Two bits per entry: the only setting that supports revocation AND suspension.
const list = await issuer.createStatusList({ maxLength: 10_000, config: { bits: 2 } });

// 3. The offer. The deeplink is what goes in the QR code.
const offer = await issuer.createOffer({
  metadata_credential_supported_id: [IMMUNIZATION.configurationId],
  credential_subject_data: { /* claims */ },
  offer_validity_seconds: 86_400,
  credential_valid_from: new Date().toISOString(),
  credential_valid_until: farFuture.toISOString(),
  status_lists: [list.statusRegistryUrl],
});
```

Keep `offer.management_id`. It is the only handle you have on the credential
afterwards — revocation, suspension and status queries all take it.

### Things that will bite you

- **`status_lists` takes the `statusRegistryUrl`, not the id.**
- **A status list is immutable** in type, config and length once initialised.
  Plan capacity; 100'000 entries at two bits is the registry's ceiling.
- **`exp` and `expiry_date` are different.** `credential_valid_until` sets `exp`:
  past it, the credential cannot be presented at all. A business `expiry_date`
  claim only warns the holder and leaves the decision to the verifier. Collapsing
  the two removes judgement from cases where it belongs.
- **Set `credential_refresh_disabled`** for anything single-use. A wallet that
  can silently re-fetch a prescription defeats redemption-by-revocation.

## Verifying a presentation

```ts
import {
  VerifierManagementClient, assertVerificationRequest, credentialQuery, dcqlQuery,
  reviewRequest, reviewPresentation, disclosedClaims, IMMUNIZATION,
  SANDBOX_HEALTH_POLICY,
} from '@didas/swiyu';

const claims = ['target_disease', 'occurrence_date', 'dose_number', 'doses_in_series'];

// 1. Am I entitled to ask for these?
const allowed = reviewRequest({ definition: IMMUNIZATION, role: myRole, requestedClaims: claims });
if (allowed.outcome === 'deny') throw new Error(allowed.reasons.at(-1));

// 2. Build the request. Both flags are MUSTs of the profile, not options.
const request = {
  dcql_query: dcqlQuery(credentialQuery({
    id: 'immunization', definition: IMMUNIZATION, claims,
    acceptedIssuerDids: [PRACTICE_DID],
  })),
  jwt_secured_authorization_request: true,
  response_mode: 'direct_post.jwt' as const,
  accepted_issuer_dids: [PRACTICE_DID],
  verification_purpose: {
    scope: 'ch.didas.health.immunization.status',
    purpose_name: { default: 'Check vaccination protection' },   // ≤ 40 chars
    purpose_description: { default: '…' },
  },
};
assertVerificationRequest(request);   // fail here, not at the wallet

const verification = await verifier.createVerification(request);
// → verification.verification_deeplink into a QR code; state starts PENDING

// 3. Read the outcome.
const result = await verifier.get(verification.id);
const decision = reviewPresentation(
  result.credential_evaluation?.immunization?.[0],
  SANDBOX_HEALTH_POLICY,
);
if (decision.outcome === 'allow') {
  const released = disclosedClaims(result, 'immunization');
}
```

### Things that will bite you

- **`purpose_name` is capped at 40 characters** by the Trust Registry when the
  vqPS is published, but the verifier's own API accepts 50. A 45-character name
  passes locally and fails at publication. `assertVerificationRequest` enforces
  40.
- **One credential per DCQL query.** `multiple` is not supported. Two
  credentials means two queries in one request — which works, and is exactly
  what check-in does.
- **Always set `accepted_issuer_dids` or `trust_anchors`.** Without either, every
  issuer DID is accepted and you cannot evaluate your counterparty at all.
- **`PENDING` is normal.** Poll, or take the webhook. The patient is looking at
  a consent screen.
- **A declined request is not an error.** `client_rejected` is a valid answer
  and your flow must work when it arrives.
- **Claims come back keyed by DCQL query id**, not by credential type.

## Using what you receive

```ts
import { projectToFhir, projectToOpenEhr, definitionByVct } from '@didas/swiyu';

const definition = definitionByVct('urn:vct:ch.didas.health.immunization:1.0')!;
const { resource, unmapped } = projectToFhir(definition, released);
```

Two properties you must design around:

1. **The projection is derived, never authoritative.** The signed credential is
   the evidence; the FHIR resource carries no signature. If you need provenance,
   retain the presentation, not the projection.
2. **The projection is legitimately partial.** After selective disclosure a
   `DiagnosticReport` may have findings and no patient name. Treating a missing
   element as an error will break you on the first minimal presentation. This is
   the real integration cost of the approach.

`unmapped` lists disclosed claims with no binding, so a modelling gap surfaces
instead of silently losing data.

## Error handling

| You see | It means |
| --- | --- |
| `ProtectedClaimError` | You asked for a protected field without an entitlement. Not retryable. |
| `ConformanceError` | Your request violates the Swiss Profile. The findings name the clause. |
| `SwiyuApiError` 4xx | The generic component rejected it — read the body. |
| `SwiyuApiError` 0 | Network. The component is down or unreachable. |
| `credential_revoked` / `_suspended` | The status list says no. Terminal for revoked. |
| `credential_missing_data` | The wallet holds nothing satisfying the query. |
| `client_rejected` | The holder declined. A normal outcome. |

## Checklist before you go live

- [ ] `preflight` and `spaces` pass; you know which environment your DIDs are in
- [ ] Separate keys: `assert-key-01` credentials, `assert-key-02` status list, `auth-key-01` JAR
- [ ] `keys/` **and** `.didtoolbox/` backed up — losing the update key means a DID you can never change
- [ ] `EXTERNAL_URL` is https and reachable from a phone
- [ ] Config regenerated for that exact URL (the metadata SRI-hashes what it serves)
- [ ] A vqPS published for every verification scope you send
- [ ] `SWIYU_TRUST_POLICY=strict` if this is production
- [ ] You store `management_id` for every credential you issue
- [ ] Your journal records claim names and not values
- [ ] Your flow degrades gracefully when the holder declines

## Reference

- [Credential reference](credentials/README.md) — claims, bindings, entitlements
- [Architecture](architecture.md) — how the layers fit
- [Swiss Profile conformance](spec-conformance.md) — every rule, and where it comes from
- [Governance framework](governance-framework.md) — the gates in detail
- [Sandbox onboarding](onboarding-sandbox.md) — getting DIDs and tokens
