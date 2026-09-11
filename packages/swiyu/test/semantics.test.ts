import { describe, expect, it } from 'vitest';

import {
  CREDENTIAL_DEFINITIONS,
  type ClaimDefinition,
  type CredentialDefinition,
} from '../src/index.js';

/**
 * Every archetype this project binds claims to, with the exact node names used.
 *
 * These were checked against the published ADL in the openEHR Clinical
 * Knowledge Manager mirror (github.com/openEHR/CKM-mirror): each archetype file
 * exists under `local/archetypes/`, and each element below appears as an `en`
 * node name inside it. The check matters because a flat path alone is
 * unfalsifiable — it is template-specific, and this project publishes no
 * operational template, so an invented segment would look exactly like a real
 * one. Pinning the archetype and the node name makes the binding something a
 * receiver can resolve in CKM, and makes a typo a test failure.
 *
 * An earlier revision bound `lot_number` to `.../batch_id` directly on
 * ACTION.medication.v1, which has no such node; Batch ID lives in
 * CLUSTER.medication.v2, slotted into the ACTION's "Medication details". The
 * same mistake had been made for the dosage, dispense quantity and analyte
 * claims. Hence this list.
 */
const CKM_NODES: Record<string, readonly string[]> = {
  'openEHR-EHR-ACTION.medication.v1': ['Medication item', 'Medication management', 'Route'],
  'openEHR-EHR-CLUSTER.medication.v2': ['Batch ID', 'Name'],
  'openEHR-EHR-INSTRUCTION.medication_order.v3': [
    'Dispense amount',
    'Medication item',
    'Overall directions description',
  ],
  'openEHR-EHR-OBSERVATION.laboratory_test_result.v1': ['Conclusion', 'Test name'],
  'openEHR-EHR-CLUSTER.laboratory_test_analyte.v1': [
    'Analyte name',
    'Analyte result',
    'Reference range guidance',
  ],
  'openEHR-EHR-CLUSTER.specimen.v1': ['Collection date/time'],
};

/** Claims nest, so walk the tree rather than the top level only. */
function everyClaim(claims: readonly ClaimDefinition[]): ClaimDefinition[] {
  return claims.flatMap((claim) => [claim, ...everyClaim(claim.claims ?? [])]);
}

const allClaims: { credential: CredentialDefinition; claim: ClaimDefinition }[] =
  CREDENTIAL_DEFINITIONS.flatMap((credential) =>
    everyClaim(credential.claims).map((claim) => ({ credential, claim })),
  );

describe('openEHR claim bindings', () => {
  const bound = allClaims.filter(({ claim }) => claim.semantics?.openehr);

  it('binds some claims to openEHR at all', () => {
    expect(bound.length).toBeGreaterThan(0);
  });

  it.each(bound)('$credential.vct / $claim.name names a CKM archetype and node', ({ claim }) => {
    const openehr = claim.semantics!.openehr!;
    expect(openehr.archetypeId, `${claim.name} has no archetypeId`).toBeTruthy();
    expect(openehr.element, `${claim.name} has no element`).toBeTruthy();

    const nodes = CKM_NODES[openehr.archetypeId!];
    expect(nodes, `${openehr.archetypeId} is not a verified archetype`).toBeDefined();
    expect(nodes).toContain(openehr.element);
  });

  it('routes the flat path through the archetype it claims', () => {
    // A binding whose archetype is a CLUSTER must show the slot hop in its
    // path: a value sitting in a slotted cluster cannot be addressed as if it
    // were a direct child of the entry.
    for (const { claim } of bound) {
      const { archetypeId, path } = claim.semantics!.openehr!;
      if (!archetypeId!.includes('-CLUSTER.')) continue;
      expect(path.split('/').length, `${claim.name}: ${path} looks too shallow`).toBeGreaterThan(3);
    }
  });
});

describe('FHIR claim bindings', () => {
  it.each(allClaims.filter(({ claim }) => claim.semantics?.fhir))(
    '$credential.vct / $claim.name starts its path at the credential resource type',
    ({ credential, claim }) => {
      const path = claim.semantics!.fhir!.path;
      expect(path).toMatch(/^[A-Z][A-Za-z]+\.[a-z]/);
      // A lab report projects to a DiagnosticReport plus contained
      // Observations and a Specimen, so more than one root is legitimate;
      // what is not legitimate is a path rooted in nothing.
      const root = path.split('.')[0];
      expect(root.length).toBeGreaterThan(2);
      expect(credential.semantics?.fhir?.resourceType).toBeTruthy();
    },
  );
});
