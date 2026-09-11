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

## 3 · Generate the configuration

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

## 4 · Start the components

```bash
cp .env.example .env    # fill in from steps 1 and 2
docker compose up
```

`EXTERNAL_URL` must be an **https** URL the wallet can actually reach; the
wallet refuses plain http. For local testing use a tunnel and regenerate the
config with the tunnel URL.

## 5 · Run the business application

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
