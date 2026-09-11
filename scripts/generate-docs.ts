/**
 * Generate the credential reference documentation.
 *
 * A credential type's claims, its semantic bindings and its governance rules
 * are declared once, in `packages/swiyu/src/credentials/`. Writing them out a
 * second time in prose guarantees the prose goes stale — usually quietly, and
 * usually in the direction that flatters the implementation. So the reference
 * pages are generated, and CI fails if they are out of date.
 *
 * What is *not* generated: the architecture, the governance framework, the
 * business case and the flows. Those are arguments, and an argument that can be
 * generated from a data structure was not worth making.
 *
 *   npm run generate:docs
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BETA_ID_CREDENTIAL,
  CREDENTIAL_DEFINITIONS,
  PROFILE_VERSION,
  PROTECTED_CLAIMS,
  VERIFICATION_QUERIES,
  type ClaimDefinition,
  type CredentialDefinition,
} from '@didas/swiyu';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(repoRoot, 'docs', 'credentials');

/** `urn:vct:ch.didas.health.immunization:1.0` → `immunization` */
function slug(definition: CredentialDefinition): string {
  return /ch\.didas\.health\.([a-z-]+)/.exec(definition.vct)?.[1] ?? definition.configurationId;
}

function escapeCell(value: string | undefined): string {
  return (value ?? '—').replace(/\|/g, '\\|');
}

function label(claim: ClaimDefinition): string {
  return claim.label['en-GB'] ?? claim.label['de-CH'] ?? claim.name;
}

/** A one-line summary of a claim's JSON Schema constraint. */
function constraint(claim: ClaimDefinition): string {
  const schema = claim.schema as Record<string, unknown>;
  if (claim.nested) return 'object';
  const parts: string[] = [];
  if (typeof schema.type === 'string') parts.push(String(schema.type));
  if (Array.isArray(schema.enum)) parts.push(`one of ${schema.enum.map(String).join(', ')}`);
  if (typeof schema.pattern === 'string') parts.push(`\`${schema.pattern}\``);
  if (typeof schema.format === 'string') parts.push(String(schema.format));
  if (typeof schema.minimum === 'number' || typeof schema.maximum === 'number') {
    parts.push(`${schema.minimum ?? ''}–${schema.maximum ?? ''}`);
  }
  if (typeof schema.maxLength === 'number') parts.push(`≤ ${schema.maxLength} chars`);
  return parts.join(', ') || '—';
}

function claimNotes(claim: ClaimDefinition): string {
  const notes: string[] = [];
  if (claim.required) notes.push('required');
  if (PROTECTED_CLAIMS.includes(claim.name)) notes.push('**protected field**');
  if (claim.sensitive) notes.push('masked in the wallet');
  return notes.join(', ') || '—';
}

function claimsTable(claims: ClaimDefinition[]): string {
  const rows = claims.map((claim) => {
    const fhir = claim.semantics?.fhir?.path;
    const openehr = claim.semantics?.openehr;
    const terminology = claim.semantics?.terminology;
    // Name the archetype and the CKM node, not just the flat path: the path is
    // specific to an operational template this project does not publish, while
    // the archetype and node name resolve in the Clinical Knowledge Manager.
    const openehrCell = openehr
      ? [
          `openEHR \`${openehr.path}\``,
          openehr.archetypeId && openehr.element
            ? `&nbsp;&nbsp;↳ \`${openehr.element}\` in \`${openehr.archetypeId}\``
            : undefined,
        ]
          .filter(Boolean)
          .join('<br>')
      : undefined;
    const semantics = [
      fhir ? `FHIR \`${fhir}\`` : undefined,
      openehrCell,
      terminology ? `${terminology.code} (\`${terminology.system}\`)` : undefined,
    ]
      .filter(Boolean)
      .join('<br>');
    return `| \`${claim.name}\` | ${escapeCell(label(claim))} | ${claim.type} | ${escapeCell(
      constraint(claim),
    )} | ${escapeCell(semantics || '—')} | ${claimNotes(claim)} |`;
  });
  return [
    '| Claim | Label | Type | Constraint | Semantic binding | Notes |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

function governanceSection(definition: CredentialDefinition): string {
  const governance = definition.governance;
  if (!governance) {
    return [
      '## Governance',
      '',
      'This credential type carries no governance block, because this project does',
      'not govern it. See the issuing authority.',
    ].join('\n');
  }

  const entitlements = governance.verifierRoles.map((entitlement) => {
    const protectedClaims = entitlement.protectedClaims?.length
      ? entitlement.protectedClaims.map((c) => `\`${c}\``).join(', ')
      : '—';
    return `| \`${entitlement.role}\` | ${escapeCell(entitlement.purpose)} | ${
      entitlement.claims.length
    } of ${definition.claims.length} | ${protectedClaims} |`;
  });

  return [
    '## Governance',
    '',
    `**Who may issue it** — \`${governance.issuerRole}\`.`,
    governance.issuerBasis ? `\n${governance.issuerBasis}.` : '',
    '',
    governance.governed
      ? 'This is a **governed** credential type: an actor must decline any interaction ' +
        'where the counterparty carries the Governed Use Case Trust Marker without the ' +
        'matching authorization marker.'
      : 'This credential type is not marked as governed.',
    '',
    '### Who may request it',
    '',
    '| Role | Purpose | Claims permitted | Protected fields |',
    '| --- | --- | --- | --- |',
    ...entitlements,
    '',
    'A request for any claim outside a role\'s entitlement is refused when the query is',
    'built, before it reaches the holder. See `reviewRequest()`.',
    '',
    governance.revocation ? `**Revocation** — ${governance.revocation}` : '',
    '',
    governance.retention ? `**Retention** — ${governance.retention}` : '',
  ]
    .filter((line) => line !== undefined)
    .join('\n');
}

function semanticsSection(definition: CredentialDefinition): string {
  const semantics = definition.semantics;
  if (!semantics) return '';
  const rows: string[] = [];
  if (semantics.fhir) {
    rows.push(
      `| HL7 FHIR | \`${semantics.fhir.resourceType}\` | ${
        semantics.fhir.profile ? `\`${semantics.fhir.profile}\`` : '—'
      } |`,
    );
  }
  if (semantics.openehr) {
    rows.push(
      `| openEHR | \`${semantics.openehr.templateId}\` | \`${semantics.openehr.archetypeId}\` |`,
    );
  }
  return [
    '## Clinical models',
    '',
    'The models are reused; the repository is not. A verifier rebuilds these',
    'representations locally from the claims the holder released — see',
    '[F-07](../../flows/F-07-model-projection.md).',
    '',
    '| Standard | Type | Profile / archetype |',
    '| --- | --- | --- |',
    ...rows,
  ].join('\n');
}

function credentialPage(definition: CredentialDefinition): string {
  const nested = definition.claims.filter((claim) => claim.nested);
  const key = definition.configurationId.replace(/_/g, '-');

  return [
    `# ${definition.name}`,
    '',
    definition.description['en-GB'] ?? definition.description['de-CH'] ?? '',
    '',
    '| | |',
    '| --- | --- |',
    `| **\`vct\`** | \`${definition.vct}\` |`,
    `| **Configuration id** | \`${definition.configurationId}\` |`,
    `| **Format** | \`dc+sd-jwt\` |`,
    `| **Profile** | \`${PROFILE_VERSION.vc}\` |`,
    `| **Refreshable** | ${definition.refreshable === undefined ? 'unspecified' : definition.refreshable ? 'yes' : 'no'} |`,
    `| **Claims** | ${definition.claims.length} |`,
    '',
    '### Displayed as',
    '',
    '| Locale | Name | Description |',
    '| --- | --- | --- |',
    ...(Object.keys(definition.displayName) as (keyof typeof definition.displayName)[]).map(
      (locale) =>
        `| \`${locale}\` | ${escapeCell(definition.displayName[locale])} | ${escapeCell(
          definition.description[locale],
        )} |`,
    ),
    '',
    governanceSection(definition),
    '',
    semanticsSection(definition),
    '',
    '## Claims',
    '',
    'Every claim is selectively disclosable — the Swiss Profile forbids',
    'non-disclosable business claims outright, which is what makes a four-claim',
    'presentation of an eighteen-claim credential possible.',
    '',
    claimsTable(definition.claims),
    '',
    ...nested.flatMap((claim) => [
      `### \`${claim.name}\` — nested claims`,
      '',
      `A selectively disclosable ${
        claim.type.startsWith('Array') ? 'array of objects' : 'object'
      }, using array-element and recursive disclosures.`,
      '',
      claimsTable(claim.nested ?? []),
      '',
    ]),
    '## Generated artefacts',
    '',
    'Produced by `npm run generate:config`, bound to each other by SRI hash:',
    '',
    '| Artefact | Path | Served at |',
    '| --- | --- | --- |',
    `| SD-JWT VC Type Metadata | \`config/<actor>/credentials/${key}/vct.json\` | \`/oid4vci/vct/${key}\` |`,
    `| JSON Schema | \`config/<actor>/credentials/${key}/schema.json\` | \`/oid4vci/json-schema/${key}\` |`,
    `| OCA bundle | \`config/<actor>/credentials/${key}/oca.json\` | \`/oid4vci/oca/${key}\` |`,
    '',
    '---',
    '',
    `*Generated from \`packages/swiyu/src/credentials/${slug(definition)}.ts\`. Do not edit by hand.*`,
    '',
  ].join('\n');
}

/**
 * The disclosure matrix: for each credential type, which role may ask for which
 * claim. This is the governance model in one table, and the thing most worth
 * putting in front of someone who is deciding whether to trust the design.
 */
function disclosureMatrix(definition: CredentialDefinition): string {
  const roles = definition.governance?.verifierRoles ?? [];
  if (roles.length === 0) return '';
  const shortRole = (role: string): string => role.split('.').pop() ?? role;

  const header = `| Claim | ${roles.map((r) => shortRole(r.role)).join(' | ')} |`;
  const divider = `| --- | ${roles.map(() => '---').join(' | ')} |`;
  const rows = definition.claims.map((claim) => {
    const marks = roles.map((role) => (role.claims.includes(claim.name) ? '●' : '·'));
    const name = PROTECTED_CLAIMS.includes(claim.name) ? `\`${claim.name}\` ⚑` : `\`${claim.name}\``;
    return `| ${name} | ${marks.join(' | ')} |`;
  });

  return [
    `### ${definition.name}`,
    '',
    header,
    divider,
    ...rows,
    '',
    '● may request · · never disclosed to this role · ⚑ protected field',
    '',
  ].join('\n');
}

function indexPage(): string {
  const rows = CREDENTIAL_DEFINITIONS.map((definition) => {
    const governance = definition.governance;
    return `| [${definition.name}](${slug(definition)}.md) | \`${definition.vct}\` | ${
      governance ? `\`${governance.issuerRole}\`` : '—'
    } | ${definition.claims.length} |`;
  });

  const queries = VERIFICATION_QUERIES.map((query) => {
    const claims = query.plans.reduce((total, plan) => total + plan.claims.length, 0);
    return `| \`${query.scope}\` | \`${query.role}\` | ${query.plans.length} | ${claims} | ${escapeCell(
      query.purposeName['default'],
    )} |`;
  });

  return [
    '# Credential reference',
    '',
    'Every credential type this project issues, generated from its definition.',
    '',
    '| Credential | `vct` | Issued by | Claims |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    `Plus the [Beta-ID](beta-id.md) (\`${BETA_ID_CREDENTIAL.vct}\`), which this project`,
    'only ever verifies — the Confederation issues it.',
    '',
    '## Who may ask for what',
    '',
    'The whole governance model in one place. A request for a claim marked `·` is',
    'refused when the query is built, not filtered out afterwards.',
    '',
    ...CREDENTIAL_DEFINITIONS.map(disclosureMatrix),
    '## Registered verification queries',
    '',
    'Each of these is published to the Trust Registry as a Verification Query Public',
    'Statement, generated from the same objects the verifier sends — see',
    '`scripts/vqps.ts`.',
    '',
    '| Scope | Asked by | Credentials | Claims | Purpose |',
    '| --- | --- | --- | --- | --- |',
    ...queries,
    '',
    '---',
    '',
    '*Generated by `npm run generate:docs`. Do not edit by hand.*',
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (const definition of CREDENTIAL_DEFINITIONS) {
    const path = join(outDir, `${slug(definition)}.md`);
    await writeFile(path, credentialPage(definition), 'utf8');
    console.log(`  ${slug(definition)}.md — ${definition.claims.length} claims`);
  }

  await writeFile(join(outDir, 'beta-id.md'), credentialPage(BETA_ID_CREDENTIAL), 'utf8');
  console.log('  beta-id.md — verified, never issued by us');

  await writeFile(join(outDir, 'README.md'), indexPage(), 'utf8');
  console.log('  README.md — index and disclosure matrix');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
