/**
 * Generate Verification Query Public Statement submissions.
 *
 * A vqPS is a signed statement published to the swiyu Trust Registry saying:
 * this verifier, this purpose, this exact query. It is the transparency half
 * of the Trust Protocol, and — unlike the entitlement half — it is available
 * today, self-service, without any governance body.
 *
 * The payloads are built from `VERIFICATION_QUERIES` and the same
 * `credentialQuery` builder the running verifier uses, so the published
 * statement cannot describe a query different from the one actually sent. A
 * vqPS that has drifted from its implementation is worse than none: it is a
 * public claim that happens to be false.
 *
 * Usage:
 *   PRAXIS_DID=… PHARMACY_DID=… TRAVEL_CLINIC_DID=… tsx scripts/vqps.ts
 *   PRAXIS_DID=… … tsx scripts/vqps.ts --submit    # with SWIYU_TRUST_REGISTRY_ACCESS_TOKEN
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  credentialQuery,
  dcqlQuery,
  entitlementFor,
  PROTECTED_CLAIMS,
  ROLE,
  SANDBOX,
  VERIFICATION_QUERIES,
  type VerificationQuerySpec,
} from '@didas/swiyu';

/** Trust Registry limits on the published statement. Tighter than the verifier's. */
const PURPOSE_NAME_MAX = 40;
const PURPOSE_DESCRIPTION_MAX = 1000;

/** Which actor sends each query, and therefore whose DID signs the statement. */
const DID_ENV_BY_ROLE: Record<string, string> = {
  [ROLE.practice]: 'PRAXIS_DID',
  [ROLE.pharmacy]: 'PHARMACY_DID',
  [ROLE.travelClinic]: 'TRAVEL_CLINIC_DID',
  [ROLE.insurer]: 'INSURER_DID',
};

/**
 * Issuer DIDs accepted per credential query. A vqPS does not carry these —
 * `accepted_issuer_dids` is a runtime parameter — so the published query is
 * the claim shape only, which is what holders need to see.
 */
function buildQuery(spec: VerificationQuerySpec): unknown {
  const queries = spec.plans.map((plan) => {
    const entitlement = entitlementFor(plan.definition, spec.role);
    const allowedProtected = entitlement?.protectedClaims ?? [];
    return credentialQuery({
      id: plan.id,
      definition: plan.definition,
      claims: plan.claims,
      protectedClaimsAuthorized: plan.claims
        .filter((claim) => PROTECTED_CLAIMS.includes(claim))
        .every((claim) => allowedProtected.includes(claim)),
    });
  });
  // Strip the runtime-only field so the published query is exactly the claim
  // shape. This deployment's list of accepted issuers stays local.
  const query = dcqlQuery(...queries) as { credentials: Record<string, unknown>[] };
  for (const credential of query.credentials) delete credential.trusted_authorities;
  return query;
}

function check(spec: VerificationQuerySpec): string[] {
  const problems: string[] = [];
  for (const [locale, text] of Object.entries(spec.purposeName)) {
    if (text.length > PURPOSE_NAME_MAX) {
      problems.push(
        `purpose_name[${locale}] is ${text.length} characters; the Trust Registry allows ${PURPOSE_NAME_MAX}`,
      );
    }
  }
  for (const [locale, text] of Object.entries(spec.purposeDescription)) {
    if (text.length > PURPOSE_DESCRIPTION_MAX) {
      problems.push(`purpose_description[${locale}] exceeds ${PURPOSE_DESCRIPTION_MAX} characters`);
    }
  }
  if (!spec.purposeName['default']) problems.push('purpose_name needs a "default" entry');
  if (!spec.purposeDescription['default']) problems.push('purpose_description needs a "default" entry');
  return problems;
}

async function main(): Promise<void> {
  const submit = process.argv.includes('--submit');
  const outDir = join(process.cwd(), 'build', 'vqps');
  await mkdir(outDir, { recursive: true });

  const token = process.env.SWIYU_TRUST_REGISTRY_ACCESS_TOKEN;
  if (submit && !token) {
    throw new Error('--submit needs SWIYU_TRUST_REGISTRY_ACCESS_TOKEN in the environment');
  }
  const endpoint = `${SANDBOX.trustRegistryApi}/api/v1/trust/vqps-submissions`;

  let failed = false;
  for (const spec of VERIFICATION_QUERIES) {
    const problems = check(spec);
    if (problems.length > 0) {
      failed = true;
      console.error(`✗ ${spec.scope}`);
      for (const problem of problems) console.error(`    ${problem}`);
      continue;
    }

    const envName = DID_ENV_BY_ROLE[spec.role];
    const did = envName ? process.env[envName] : undefined;
    if (!did) {
      console.error(`✗ ${spec.scope}: set ${envName} to the DID of the ${spec.role} verifier`);
      failed = true;
      continue;
    }

    const payload = {
      sub: did,
      scope: spec.scope,
      purpose_name: spec.purposeName,
      purpose_description: spec.purposeDescription,
      query: buildQuery(spec),
    };
    const path = join(outDir, `${spec.scope}.json`);
    await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    const claimCount = spec.plans.reduce((total, plan) => total + plan.claims.length, 0);
    console.log(`✓ ${spec.scope} — ${spec.plans.length} credential(s), ${claimCount} claim(s) → ${path}`);

    if (!submit) {
      console.log(
        `    curl -X POST "${endpoint}" \\\n` +
          `      -H "Authorization: Bearer $SWIYU_TRUST_REGISTRY_ACCESS_TOKEN" \\\n` +
          `      -H 'Content-Type: application/json' --data-binary @${path}`,
      );
      continue;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.text();
    if (!response.ok) {
      failed = true;
      console.error(`    submission failed: HTTP ${response.status} ${body.slice(0, 400)}`);
    } else {
      console.log(`    submitted: ${body.slice(0, 200)}`);
    }
  }

  if (failed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
