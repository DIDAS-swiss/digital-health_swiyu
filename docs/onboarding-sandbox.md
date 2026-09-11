# Running against the swiyu Sandbox

The demo runs offline by default. This is what it takes to run the same code
against the real Sandbox trust infrastructure.

Budget a day for a first onboarding, mostly waiting on portal steps. Repeat it
per actor: each is a separate legal entity with its own DID.

> **Sandbox, not production.** The environment formerly called Public Beta was
> renamed Sandbox by change dossier CD-001 and separated from production. Use
> the **swiyu Sandbox Wallet** ([iOS](https://apps.apple.com/us/app/swiyu-sandbox-wallet/id6771296857),
> [Android](https://github.com/swiyu-admin-ch/eidch-android-wallet/releases)) —
> the production swiyu Wallet will refuse these credentials.

## What only a person can do

Three things in this runbook cannot be automated, delegated to a contractor, or
done from a CI job, because they bind a legal entity to a cryptographic
identity:

1. **The ePortal account and business partner registration.** A federal ePortal
   account for the organisation, then a business partner under it.
2. **The trust onboarding.** Proving control of the DID's assertion key to the
   Trust Registry, which is what yields the Verified Identity Trust Marker.
3. **Accepting that DIDs are chargeable.** The Base Registry bills per hosted
   DID. Decide how many you actually need before creating them.

Everything else — key generation, DID logs, API calls, deployment — is scripted.

### Limits and costs

| | |
| --- | --- |
| Business partners per ePortal account | 50 |
| DIDs per business partner | 100 — **each DID is charged** |
| Status lists per business partner | 200 |

One business partner can hold several DIDs, so a four-actor demo needs **one**
registration, not four. Trust onboarding is still per DID.

### The leanest setup that shows the showcase

| Actor | DID | Keys | Why |
| --- | --- | --- | --- |
| Practice | 1 | assert ×2 (SD-JWT, status list), auth ×1 | Issues the immunization credential and verifies at check-in |
| Travel clinic | 1 | auth ×1 | Verifies four claims — this is the demonstration |

Two DIDs. The insurer and pharmacy can come later; the Beta-ID is free from the
Beta Credential Service. Check-in needs an insurance card, so either add a third
DID for the insurer or run the immunization flow on its own.

## The scripted path

Once you have an ePortal account, a business partner and API tokens,
`scripts/onboard.sh` does the rest:

```bash
cp .env.onboard.example .env.onboard     # fill in PARTNER_ID and the tokens
./scripts/onboard.sh preflight
./scripts/onboard.sh did praxis          # claim a space, make keys, upload the DID log
#  → start the trust onboarding for this DID in the Service Portal, then:
./scripts/onboard.sh trust-first praxis
./scripts/onboard.sh did travel-clinic
./scripts/onboard.sh trust-add praxis travel-clinic
./scripts/onboard.sh vqps                # publish what each verifier asks for
./scripts/onboard.sh env                 # DIDs and verification methods for .env
```

Private keys are generated on your machine under `.swiyu/<actor>/.didtoolbox/`,
are git-ignored, and are never transmitted — the DID log that *is* uploaded
contains public keys only. **Back that directory up**: a lost signing key means
a DID you can no longer update, and a lost assertion key means credentials you
can no longer revoke.

The manual steps below are what the script automates, kept for when something
goes wrong and you need to see the actual call.

## 1 · Business partner and API access

1. Register on the [swiyu Service Portal](https://portal.trust-infra.swiyu-int.admin.ch)
   and note your `PARTNER_ID`.
2. Subscribe to the swiyu Trust Infrastructure APIs on the
   [API self-service portal](https://selfservice.api.admin.ch/api-selfservice/apis).
   You need `swiyucorebusiness_status` for status lists.
3. Save the customer key, customer secret, access token and refresh token. The
   refresh token is shown once.

## 2 · Keys and DID

Use [DID Toolbox](https://github.com/swiyu-admin-ch/didtoolbox-java/releases/latest)
**2.1.0 or newer** — CD-001 requires new DIDs to use `did:webvh`, and older
tooling emits the superseded `did:tdw` spelling.

```bash
# Reserve an identifier entry; keep the identifierRegistryUrl it returns.
curl -X POST -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://identifier-reg-api.trust-infra.swiyu-int.admin.ch/api/v1/identifier/business-entities/$PARTNER_ID/identifier/"

# Generate the DID log.
java -jar didtoolbox.jar create --identifier-registry-url "$IDENTIFIER_REGISTRY_URL"

# Upload it.
curl -X PUT -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' \
  --data @did.jsonl \
  "https://identifier-reg-api.trust-infra.swiyu-int.admin.ch/api/v1/identifier/business-entities/$PARTNER_ID/identifier-entries/$ENTRY_ID"
```

Generate **three** key pairs per issuing actor and keep them apart:

| Key | Verification method | Used for |
| --- | --- | --- |
| SD-JWT signing | `#assert-key-01` | Signing issued credentials |
| Status list signing | `#assert-key-02` | Signing the status list token |
| Authentication | `#auth-key-01` | Signing the verifier's JAR |

Separate keys are not ceremony: the status list is published publicly and
re-signed daily, while the credential signing key should be used as little as
possible. A verifier-only actor needs the authentication key alone.

Then complete the trust onboarding in the Service Portal — a proof of possession
JWT signed with the assertion key — which yields the Verified Identity Trust
Marker. Consider migrating to
[Trust Protocol 2.0](https://swiyu-admin-ch.github.io/change-dossiers/CD-006-Trust-Protocol-2.0/)
at the same time.

> **The role grant does not exist yet.** `viTM` says the Confederation verified
> *who* you are. It does not say you are a medical practice authorised to
> vaccinate. That statement needs a health-domain governance body, and there
> isn't one. Until there is, verification relies on explicitly listed issuer
> DIDs. See [F-01](../flows/F-01-actor-onboarding.md), open question 1.

## 3 · Publish what each verifier will ask for (vqPS)

This is the step most easily mistaken for "we need a governance body first". It
is not — it is self-service, and it is the mechanism by which a verifier states
publicly what it intends to request.

A **Verification Query Public Statement** is a signed JWT published to the Trust
Registry carrying a scope, a localised purpose, and the DCQL query itself. Submit
one per verifier DID per query:

```bash
curl -X POST -H "Authorization: Bearer $TRUST_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  "https://trust-reg-api.trust-infra.swiyu-int.admin.ch/api/v1/trust/vqps-submissions" \
  -d '{
    "sub": "'"$TRAVEL_CLINIC_DID"'",
    "scope": "ch.didas.health.immunization.status",
    "purpose_name": { "default": "Check vaccination protection" },
    "purpose_description": { "default": "Asks only which diseases you are protected against and when — not the vaccine brand, the batch, or who vaccinated you." },
    "query": { "credentials": [ { "id": "immunization", "format": "dc+sd-jwt",
      "meta": { "vct_values": ["urn:vct:ch.didas.health.immunization:1.0"] },
      "claims": [ {"path":["target_disease"]}, {"path":["occurrence_date"]},
                  {"path":["dose_number"]}, {"path":["doses_in_series"]} ] } ] }
  }'
```

The scope, purpose and query are exactly the `verification_purpose` and
`dcql_query` this project already builds, so the published statement and the
running verifier cannot disagree.

> **A limit that will bite you.** `purpose_name` may be **40 characters** per
> locale here, while the generic verifier's own management API accepts 50. A
> 45-character name passes locally and fails at publication. `conformance.ts`
> enforces 40 for this reason.

### What is still not possible

Publishing *what you ask for* is self-service. Being certified as *entitled to
ask* — the Governed Use Case Authorization Trust Marker naming a health
credential type — is not, because no health-domain governance body exists to
issue it. Until one does, verification relies on `accepted_issuer_dids`, which
this project sets on every request and which is sufficient for a pilot.
See [F-01](../flows/F-01-actor-onboarding.md).

## 4 · Generate the configuration

```bash
npm run generate:config -- \
  --insurer-url       https://insurer.example.ch \
  --praxis-url        https://praxis.example.ch \
  --pharmacy-url      https://pharmacy.example.ch \
  --travel-clinic-url https://travel.example.ch
```

These URLs are baked into the generated metadata, because the issuer metadata
carries an SRI hash over the exact bytes of the Type Metadata document. Change a
URL, regenerate — it is part of deployment, not a one-off.

The generator runs the conformance checks and fails rather than emitting
metadata a wallet would reject.

## 5 · Start the components

```bash
cp .env.example .env    # fill in from steps 1 and 2
docker compose up
```

`EXTERNAL_URL` must be an **https** URL the wallet can actually reach — from a
phone, over the public internet, with a certificate it trusts. The wallet refuses
plain http, and `localhost` is not reachable from a phone.

In practice this means one of:

| | Good for | Watch out for |
| --- | --- | --- |
| A tunnel (`cloudflared`, `ngrok`) from a laptop | A demo you run yourself | The URL changes each restart, and the generated config is pinned to it — regenerate every time |
| A small VPS or cloud host with a real certificate | A demo other people can try | Needs a stable hostname, which is what you want anyway |

Whichever you pick, the URL goes into the config generation in step 4, not just
into the environment: the issuer metadata carries an SRI hash over the exact
bytes of the Type Metadata document served at that URL.

## 6 · Run the business application

```bash
SWIYU_MODE=sandbox npm start
```

Get a Beta-ID from the [Beta Credential Service](https://www.bcs.admin.ch/bcs-web)
— it carries the Art. 15 BGEID attribute set, the same attributes the e-ID will
have — then walk the journey, scanning each QR code with the Sandbox Wallet.

## Checks when something does not work

| Symptom | Usual cause |
| --- | --- |
| Wallet refuses to open the deeplink | `EXTERNAL_URL` is http, unreachable, or has a certificate the phone rejects |
| Wallet reports invalid metadata | Config generated for a different URL than the issuer serves; regenerate |
| Credential collected but blank in the wallet | OCA bundle unreachable or its SRI hash does not match; every OCA object must be valid or the whole bundle is discarded |
| Verification always fails | `accepted_issuer_dids` does not contain the actual issuer DID |
| Status list upload rejected | `iat` older than 24 hours, `exp` missing or past, or the token exceeds 200 KB |
| Production swiyu Wallet refuses everything | Expected — CD-001. Use the Sandbox Wallet |

## Validating properly

The mock proves nothing about protocol conformance. Against real components, use
the Confederation's own harnesses:

- [swiyu-generic-application-test](https://github.com/swiyu-admin-ch/swiyu-generic-application-test)
- [swiyu-generic-test-wallet](https://github.com/swiyu-admin-ch/swiyu-generic-test-wallet)
