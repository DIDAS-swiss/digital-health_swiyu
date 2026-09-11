/**
 * Client for the management API of a `swiyu-issuer` deployment.
 *
 * The generic issuer owns everything the Swiss Profile makes hard: DPoP, the
 * pre-authorized code flow, key attestation, mandatory request/response
 * encryption, signed issuer metadata, SD-JWT VC assembly and status list
 * publication to the Base Registry. A business issuer only creates offers and
 * moves credentials through their lifecycle — which is exactly this surface.
 */

import { HttpClient, type HttpOptions } from './http.js';
import { LIMITS } from './profile.js';
import type {
  CreateCredentialOfferRequest,
  CredentialWithDeeplinkResponse,
  StatusList,
  StatusListCreateRequest,
  UpdateCredentialStatusRequestType,
  UpdateStatusResponse,
} from './types.js';

export class IssuerManagementClient {
  private readonly http: HttpClient;

  constructor(options: HttpOptions) {
    this.http = new HttpClient(options);
  }

  /**
   * Initialise a status list slot. This is a one-time operation per list: type,
   * config and length are immutable afterwards. Keep the returned
   * `statusRegistryUrl` — offers reference the list by that URI, not by id.
   */
  async createStatusList(request: StatusListCreateRequest): Promise<StatusList> {
    if (request.maxLength > LIMITS.statusListMaxEntries) {
      throw new RangeError(
        `maxLength ${request.maxLength} exceeds the ${LIMITS.statusListMaxEntries} entries that fit ` +
          `in the registry's 200 KB status list limit at ${request.config.bits} bits per entry`,
      );
    }
    return this.http.post<StatusList>('/management/api/status-list', request);
  }

  getStatusList(statusListId: string): Promise<StatusList> {
    return this.http.get<StatusList>(`/management/api/status-list/${statusListId}`);
  }

  /** Force a publication of the status list to the registry. */
  publishStatusList(statusListId: string): Promise<StatusList> {
    return this.http.post<StatusList>(`/management/api/status-list/${statusListId}`, {});
  }

  /**
   * Create a credential offer. The returned deeplink is what goes into the QR
   * code; the wallet redeems it through the pre-authorized code flow.
   */
  createOffer(request: CreateCredentialOfferRequest): Promise<CredentialWithDeeplinkResponse> {
    return this.http.post<CredentialWithDeeplinkResponse>(
      '/management/api/credentials',
      request,
    );
  }

  getCredential(managementId: string): Promise<unknown> {
    return this.http.get(`/management/api/credentials/${managementId}`);
  }

  /**
   * Move a credential through its lifecycle. `REVOKED` is terminal and flips the
   * bit on the published status list; `SUSPENDED` is reversible via `ISSUED`.
   */
  updateStatus(
    managementId: string,
    status: UpdateCredentialStatusRequestType,
  ): Promise<UpdateStatusResponse> {
    return this.http.patch<UpdateStatusResponse>(
      `/management/api/credentials/${managementId}/status?credentialStatus=${status}`,
    );
  }

  revoke(managementId: string): Promise<UpdateStatusResponse> {
    return this.updateStatus(managementId, 'REVOKED');
  }

  suspend(managementId: string): Promise<UpdateStatusResponse> {
    return this.updateStatus(managementId, 'SUSPENDED');
  }

  reinstate(managementId: string): Promise<UpdateStatusResponse> {
    return this.updateStatus(managementId, 'ISSUED');
  }
}
