/**
 * Generate the deployment configuration for the swiyu generic components from
 * the credential definitions.
 *
 * Everything a `swiyu-issuer` instance needs to serve a credential type — the
 * issuer metadata, the SD-JWT VC Type Metadata, the JSON Schema, the OCA bundle
 * and the file-key mapping that binds them to URLs — is derived here from one
 * TypeScript definition per credential type.
 *
 * The external URL is baked in at generation time rather than left as the
 * issuer's `${external-url}` placeholder. It has to be: the issuer metadata
 * carries `vct_metadata_uri#integrity`, an SRI hash over the *exact bytes* of
 * the Type Metadata document. If the document were templated and substituted at
 * serve time, the hash computed here would describe a document that is never
 * actually served, and every wallet would reject it. So: change the URL,
 * regenerate the config. `npm run generate:config` is part of deployment.
 *
 * Usage:
 *   tsx scripts/generate-config.ts --insurer-url https://insurer.example.ch \
 *                                  --praxis-url  https://praxis.example.ch  \
 *                                  --pharmacy-url https://pharmacy.example.ch \
 *                                  --travel-clinic-url https://travel.example.ch
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertIssuerMetadata,
  assertOcaBundle,
  buildIssuerMetadata,
  buildJsonSchema,
  buildOcaBundle,
  buildVctMetadata,
  IMMUNIZATION,
  INSURANCE_CARD,
  LAB_REPORT,
  PRESCRIPTION,
  PROFILE_VERSION,
  type CredentialDefinition,
  type Localized,
  type MetadataUris,
} from '@didas/swiyu';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

interface ActorSpec {
  /** Directory name under config/. */
  key: string;
  externalUrl: string;
  display: { name: Localized; logo?: string };
  /** Credential types this actor issues. Empty for a pure verifier. */
  issues: CredentialDefinition[];
  /** Client metadata for an actor that verifies. */
  verifies?: { clientName: Localized };
}

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token?.startsWith('--')) continue;
    const [flag, inline] = token.slice(2).split('=', 2);
    if (!flag) continue;
    args[flag] = inline ?? argv[++i] ?? '';
  }
  return args;
}

/** Stable, URL-safe file key for a credential type's metadata documents. */
function fileKey(definition: CredentialDefinition): string {
  return definition.configurationId.replace(/_/g, '-');
}

function metadataUris(externalUrl: string, definition: CredentialDefinition): MetadataUris {
  const base = externalUrl.replace(/\/+$/, '');
  const key = fileKey(definition);
  return {
    vctMetadataUri: `${base}/oid4vci/vct/${key}`,
    schemaUri: `${base}/oid4vci/json-schema/${key}`,
    ocaUri: `${base}/oid4vci/oca/${key}`,
  };
}

/**
 * Canonical serialisation for every generated document.
 *
 * The bytes matter: the SRI hashes in the issuer metadata are computed over
 * exactly what is written here, so the formatting must be identical between the
 * hash computation and the file on disk. Two spaces, trailing newline, always.
 */
function serialize(document: unknown): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

async function writeJson(path: string, document: unknown): Promise<string> {
  const content = serialize(document);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
  return content;
}

async function generateActor(actor: ActorSpec): Promise<void> {
  const actorDir = join(repoRoot, 'config', actor.key);
  await rm(actorDir, { recursive: true, force: true });
  await mkdir(actorDir, { recursive: true });

  // Generate the per-credential documents first: the issuer metadata hashes
  // the Type Metadata, which in turn hashes the schema and the OCA bundle, so
  // the order is forced from the leaves inwards.
  const documents = new Map<string, { vct: string }>();
  const fileKeys: Record<string, { vct: string; schema: string; oca: string }> = {};

  for (const definition of actor.issues) {
    const uris = metadataUris(actor.externalUrl, definition);
    const key = fileKey(definition);
    const credentialDir = join(actorDir, 'credentials', key);

    const schema = buildJsonSchema(definition, uris.schemaUri);
    const schemaContent = await writeJson(join(credentialDir, 'schema.json'), schema);

    const oca = buildOcaBundle(definition);
    assertOcaBundle(oca);
    const ocaContent = await writeJson(join(credentialDir, 'oca.json'), oca);

    const vct = buildVctMetadata(definition, uris, { schema: schemaContent, oca: ocaContent });
    const vctContent = await writeJson(join(credentialDir, 'vct.json'), vct);

    documents.set(definition.configurationId, { vct: vctContent });
    fileKeys[key] = {
      vct: `file:/cfg-files/credentials/${key}/vct.json`,
      schema: `file:/cfg-files/credentials/${key}/schema.json`,
      oca: `file:/cfg-files/credentials/${key}/oca.json`,
    };
  }

  if (actor.issues.length > 0) {
    const issuerMetadata = buildIssuerMetadata({
      externalUrl: actor.externalUrl,
      display: actor.display,
      definitions: actor.issues,
      metadataUris: (definition) => metadataUris(actor.externalUrl, definition),
      documents: (definition) => {
        const document = documents.get(definition.configurationId);
        if (!document) throw new Error(`missing generated documents for ${definition.configurationId}`);
        return document;
      },
    });
    // Fail the build rather than deploy metadata a wallet will reject.
    assertIssuerMetadata(issuerMetadata);
    await writeJson(join(actorDir, 'issuer_metadata.json'), issuerMetadata);

    await writeJson(join(actorDir, 'openid_metadata.json'), {
      issuer: actor.externalUrl.replace(/\/+$/, ''),
      token_endpoint: `${actor.externalUrl.replace(/\/+$/, '')}/oid4vci/api/token`,
    });

    // The generic issuer maps each metadata document to a URL path by key; this
    // fragment is mounted as additional Spring configuration.
    const lines = [
      '# Generated by scripts/generate-config.ts — do not edit by hand.',
      '# Maps the generated metadata documents onto the URLs referenced from the',
      '# issuer metadata. The keys must match the paths in vct_metadata_uri.',
      'application:',
      '  vct-metadata-files:',
      ...Object.entries(fileKeys).map(([key, paths]) => `    ${key}: "${paths.vct}"`),
      '  json-schema-metadata-files:',
      ...Object.entries(fileKeys).map(([key, paths]) => `    ${key}: "${paths.schema}"`),
      '  overlays-capture-architecture-metadata-files:',
      ...Object.entries(fileKeys).map(([key, paths]) => `    ${key}: "${paths.oca}"`),
      '',
    ];
    await mkdir(actorDir, { recursive: true });
    await writeFile(join(actorDir, 'application-credentials.yml'), lines.join('\n'), 'utf8');
  }

  if (actor.verifies) {
    // The verifier's client metadata, served at
    // /oid4vp/api/openid-client-metadata.json and shown to the holder before
    // they consent. `client_id` is substituted from VERIFIER_DID at runtime.
    await writeJson(join(actorDir, 'verifier_metadata.json'), {
      client_id: '${VERIFIER_DID}',
      client_name: actor.verifies.clientName['en-GB'] ?? actor.key,
      'client_name#de-CH': actor.verifies.clientName['de-CH'],
      'client_name#fr-CH': actor.verifies.clientName['fr-CH'],
      'client_name#it-CH': actor.verifies.clientName['it-CH'],
      'client_name#en': actor.verifies.clientName['en-GB'],
      vp_formats_supported: {
        // Static wallet metadata per swiss-profile-verification §10.2.
        'dc+sd-jwt': {
          'sd-jwt_alg_values': ['ES256'],
          'kb-jwt_alg_values': ['ES256'],
        },
      },
    });
  }

  console.log(`  ${actor.key}: ${actor.issues.length} credential type(s) at ${actor.externalUrl}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const insurerUrl = args['insurer-url'] ?? 'http://localhost:8080';
  const praxisUrl = args['praxis-url'] ?? 'http://localhost:8081';
  const pharmacyUrl = args['pharmacy-url'] ?? 'http://localhost:8082';
  const travelClinicUrl = args['travel-clinic-url'] ?? 'http://localhost:8083';

  console.log(`Generating config for Swiss Profiles ${PROFILE_VERSION.issuance} / ${PROFILE_VERSION.vc}`);

  await generateActor({
    key: 'insurer',
    externalUrl: insurerUrl,
    display: {
      name: {
        'de-CH': 'DIDAS Krankenversicherung (Demo)',
        'fr-CH': 'DIDAS assurance-maladie (démo)',
        'it-CH': 'DIDAS assicurazione malattia (demo)',
        'en-GB': 'DIDAS Health Insurance (demo)',
      },
    },
    issues: [INSURANCE_CARD],
  });

  await generateActor({
    key: 'praxis',
    externalUrl: praxisUrl,
    display: {
      name: {
        'de-CH': 'DIDAS Hausarztpraxis (Demo)',
        'fr-CH': 'DIDAS Cabinet médical (démo)',
        'it-CH': 'DIDAS Studio medico (demo)',
        'en-GB': 'DIDAS Family Practice (demo)',
      },
    },
    // The immunization credential comes first: it is the showcase case, and
    // the practice issues it in its authorised-vaccinator role.
    issues: [IMMUNIZATION, PRESCRIPTION, LAB_REPORT],
    verifies: {
      clientName: {
        'de-CH': 'DIDAS Hausarztpraxis',
        'fr-CH': 'DIDAS Cabinet médical',
        'it-CH': 'DIDAS Studio medico',
        'en-GB': 'DIDAS Family Practice',
      },
    },
  });

  await generateActor({
    key: 'pharmacy',
    externalUrl: pharmacyUrl,
    display: { name: { 'en-GB': 'DIDAS Pharmacy (demo)' } },
    issues: [],
    verifies: {
      clientName: {
        'de-CH': 'DIDAS Apotheke',
        'fr-CH': 'DIDAS Pharmacie',
        'it-CH': 'DIDAS Farmacia',
        'en-GB': 'DIDAS Pharmacy',
      },
    },
  });

  await generateActor({
    key: 'travel-clinic',
    externalUrl: travelClinicUrl,
    display: { name: { 'en-GB': 'DIDAS Travel Medicine (demo)' } },
    issues: [],
    verifies: {
      clientName: {
        'de-CH': 'DIDAS Reisemedizin',
        'fr-CH': 'DIDAS Médecine des voyages',
        'it-CH': 'DIDAS Medicina di viaggio',
        'en-GB': 'DIDAS Travel Medicine',
      },
    },
  });

  console.log('Done. Mount config/<actor> into the matching generic component.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
