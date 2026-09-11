/**
 * The Beta-ID, described in the same shape as this project's own credential
 * types so it can be used in a DCQL query.
 *
 * It is the Sandbox stand-in for the e-ID and carries the attribute set of
 * Art. 15 BGEID; from go-live the e-ID replaces it with the same attributes,
 * so a flow written against this does not change shape in 2026 — only the
 * issuer DID and the `vct` do.
 *
 * Two deliberate omissions. There is no `governance` block: the Confederation
 * governs this credential, and writing rules for it here
 * would put expectations in our repository that nobody here can enforce. And
 * it is not a member of `CREDENTIAL_DEFINITIONS`, which is the set of types
 * this project *issues* — we only ever verify this one.
 */

import type { CredentialDefinition } from '../credential-definition.js';
import { BETA_ID } from '../profile.js';

export const BETA_ID_CREDENTIAL: CredentialDefinition = {
  configurationId: 'betaid_sd_jwt',
  vct: BETA_ID.vct,
  name: 'Beta-ID',
  displayName: { 'de-CH': 'Beta-ID', 'fr-CH': 'Beta-ID', 'it-CH': 'Beta-ID', 'en-GB': 'Beta-ID' },
  description: {
    'de-CH': 'Pseudo-Identitätsnachweis der Sandbox mit den Attributen der künftigen E-ID.',
    'en-GB': 'Sandbox pseudo-identity credential carrying the attribute set of the future e-ID.',
  },
  backgroundColor: '#8A1C21',
  claims: [
    {
      name: 'given_name',
      type: 'Text',
      label: { 'de-CH': 'Vorname(n)', 'en-GB': 'Given name(s)' },
      schema: { type: 'string' },
    },
    {
      name: 'family_name',
      type: 'Text',
      label: { 'de-CH': 'Name', 'en-GB': 'Surname' },
      schema: { type: 'string' },
    },
    {
      name: 'birth_date',
      type: 'DateTime',
      label: { 'de-CH': 'Geburtsdatum', 'en-GB': 'Date of birth' },
      schema: { type: 'string', format: 'date' },
    },
    {
      name: 'age_over_18',
      type: 'Boolean',
      label: { 'de-CH': 'Über 18', 'en-GB': 'Over 18' },
      schema: { type: 'boolean' },
    },
    {
      name: 'personal_administrative_number',
      type: 'Text',
      label: { 'de-CH': 'AHV-Nummer', 'en-GB': 'Social security number' },
      schema: { type: 'string' },
    },
  ],
};
