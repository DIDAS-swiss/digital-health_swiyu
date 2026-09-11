/**
 * Client for the management API of a `swiyu-verifier` deployment.
 *
 * The generic verifier signs the JWT-Secured Authorization Request, serves the
 * request object, decrypts the `direct_post.jwt` response, checks the key
 * binding, resolves the issuer DID, evaluates the Token Status List and runs
 * the Trust Protocol 2.0 marker evaluation. A business verifier states *what*
 * it wants (a DCQL query and a purpose) and reads the outcome.
 */

import { HttpClient, type HttpOptions } from './http.js';
import type {
  CreateVerificationRequest,
  VerificationManagementResponse,
} from './types.js';

export class VerifierManagementClient {
  private readonly http: HttpClient;

  constructor(options: HttpOptions) {
    this.http = new HttpClient(options);
  }

  /**
   * Open a verification. The response carries the deeplink for the QR code and
   * starts out `PENDING`; poll `get()` (or take the webhook) until it settles.
   */
  createVerification(
    request: CreateVerificationRequest,
  ): Promise<VerificationManagementResponse> {
    return this.http.post<VerificationManagementResponse>(
      '/management/api/verifications',
      request,
    );
  }

  get(verificationId: string): Promise<VerificationManagementResponse> {
    return this.http.get<VerificationManagementResponse>(
      `/management/api/verifications/${verificationId}`,
    );
  }
}
