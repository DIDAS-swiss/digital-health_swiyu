import type { CredentialDefinition } from '../credential-definition.js';
import { IMMUNIZATION } from './immunization.js';
import { INSURANCE_CARD } from './insurance-card.js';
import { LAB_REPORT } from './lab-report.js';
import { PRESCRIPTION } from './prescription.js';

export { IMMUNIZATION, INSURANCE_CARD, LAB_REPORT, PRESCRIPTION };

/** Every credential type this project issues, keyed by `vct`. */
export const CREDENTIAL_DEFINITIONS: readonly CredentialDefinition[] = [
  IMMUNIZATION,
  INSURANCE_CARD,
  PRESCRIPTION,
  LAB_REPORT,
];

export function definitionByVct(vct: string): CredentialDefinition | undefined {
  return CREDENTIAL_DEFINITIONS.find((definition) => definition.vct === vct);
}

export function definitionByConfigurationId(id: string): CredentialDefinition | undefined {
  return CREDENTIAL_DEFINITIONS.find((definition) => definition.configurationId === id);
}
