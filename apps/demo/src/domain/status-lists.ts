/**
 * Lazily initialise one status list per issuer.
 *
 * A status list slot is initialised once and is then immutable in type, config
 * and length. Two bits per entry is the only choice that supports both
 * revocation and suspension, and both are needed here: a prescription is
 * revoked when dispensed, an insurance card is suspended while cover is being
 * clarified.
 */

import { LIMITS, type IssuerManagementClient } from '@didas/swiyu';

export class StatusListPool {
  private readonly uris = new Map<string, Promise<string>>();

  constructor(private readonly size = 10_000) {
    if (size > LIMITS.statusListMaxEntries) {
      throw new RangeError(`a status list holds at most ${LIMITS.statusListMaxEntries} entries at 2 bits each`);
    }
  }

  /** The status list URI for this issuer, creating it on first use. */
  async uriFor(key: string, client: IssuerManagementClient): Promise<string> {
    const existing = this.uris.get(key);
    if (existing) return existing;
    const created = client
      .createStatusList({ maxLength: this.size, config: { bits: 2 } })
      .then((list) => list.statusRegistryUrl)
      .catch((error: unknown) => {
        // Don't cache a failure: a transient registry outage should not take
        // the issuer out of service for the rest of the process's life.
        this.uris.delete(key);
        throw error;
      });
    this.uris.set(key, created);
    return created;
  }
}
