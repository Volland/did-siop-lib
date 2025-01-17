import {
  RSAVerifier,
  ECVerifier,
  OKPVerifier,
  ES256KRecoverableVerifier,
} from "./verifiers";
import {
  RSASigner,
  ECSigner,
  OKPSigner,
  ES256KRecoverableSigner,
} from "./signers";
import { Key, RSAKey, OKP, ECKey, KeyInputs } from "./jwk-utils";
import { KEY_FORMATS, ALGORITHMS, KTYS } from "./globals";
import { DidSiopResponse } from "./response";
import { SigningInfo, JWTObject } from "./jwt";
import { Identity, DidDocument } from "./identity";
import { DidSiopRequest } from "./request";
import { VPData, SIOPTokensEcoded } from "./claims";
import {
  checkKeyPair,
  isMultibasePvtKey,
  getBase58fromMultibase,
} from "./utils";
import * as ErrorResponse from "./error-response";
import { DidResolver } from "./identity/resolvers/did-resolver-base";

export const ERRORS = Object.freeze({
  NO_SIGNING_INFO:
    "At least one public key must be confirmed with related private key",
  UNRESOLVED_IDENTITY: "Unresolved identity",
  NO_PUBLIC_KEY: "No public key matches given private key",
});

/**
 * @classdesc This class provides the functionality of a DID based Self Issued OpenID Connect Provider
 * @property {Identity} identity  - Used to store Decentralized Identity information of the Provider (end user)
 * @property {SigningInfo[]} signing_info_set - Used to store a list of cryptographic information used to sign id_tokens
 */
export class Provider {
  private identity: Identity = new Identity();
  private signing_info_set: SigningInfo[] = [];
  private resolvers: DidResolver[] = [];

  private constructor() {}

  /**
   * @param {string} did - The DID of the provider (end user)
   * @param {DidDocument} [doc] - DID Document of the provider (end user).
   * @param {DidResolver[]} [resolvers] - Array of Resolvers (Derived from DidResolver) to be used for DID resolution
   * @remarks This method is used to set the decentralized identity for the provider (end user).
   * doc parameter is optional and if provided it will be used to directly set the identity.
   * Otherwise the DID Document will be resolved over a related network.
   */
  static async getProvider(
    did: string,
    doc?: DidDocument,
    resolvers?: DidResolver[]
  ): Promise<Provider> {
    try {
      let provider = new Provider();
      await provider.setUser(did, doc, resolvers);
      return provider;
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * @param {string} did - The DID of the provider (end user)
   * @param {DidDocument} [doc] - DID Document of the provider (end user).
   * @remarks This method is used to set the decentralized identity for the provider (end user).
   * doc parameter is optional and if provided it will be used to directly set the identity.
   * Otherwise the DID Document will be resolved over a related network.
   */
  async setUser(did: string, doc?: DidDocument, resolvers?: DidResolver[]) {
    try {
      if (doc) {
        this.identity.setDocument(doc, did);
      } else {
        if (resolvers && resolvers.length > 0) {
          this.identity.addResolvers(resolvers);
          this.resolvers = resolvers;
        }
        await this.identity.resolve(did);
      }
    } catch (err) {
      throw err;
    }
  }

  /**
   * @param {string} key - Private part of any cryptographic key listed in the 'authentication' field of the user's DID Document
   * @returns {string} - kid of the added key
   * @remarks This method is used to add signing information to 'signing_info_set'.
   * Given key is iteratively tried with
   * every public key listed in the 'authentication' field of RP's DID Document and every key format
   * until a compatible combination of those information which can be used for the signing process is found.
   */
  addSigningParams(key: string): string {
    try {
      let didPublicKeySet = this.identity.extractAuthenticationKeys();

      if (isMultibasePvtKey(key)) key = getBase58fromMultibase(key);

      for (let didPublicKey of didPublicKeySet) {
        let publicKeyInfo: KeyInputs.KeyInfo = {
          key: didPublicKey.publicKey,
          kid: didPublicKey.id,
          use: "sig",
          kty: KTYS[didPublicKey.kty],
          alg: ALGORITHMS[didPublicKey.alg],
          format: didPublicKey.format,
          isPrivate: false,
        };

        for (let key_format in KEY_FORMATS) {
          let privateKeyInfo: KeyInputs.KeyInfo = {
            key: key,
            kid: didPublicKey.id,
            use: "sig",
            kty: KTYS[didPublicKey.kty],
            alg: ALGORITHMS[didPublicKey.alg],
            format: KEY_FORMATS[key_format as keyof typeof KEY_FORMATS],
            isPrivate: true,
          };

          let privateKey: Key;
          let publicKey: Key | string;
          let signer, verifier;

          try {
            switch (didPublicKey.kty) {
              case KTYS.RSA: {
                privateKey = RSAKey.fromKey(privateKeyInfo);
                publicKey = RSAKey.fromKey(publicKeyInfo);
                signer = new RSASigner();
                verifier = new RSAVerifier();
                break;
              }
              case KTYS.EC: {
                if (didPublicKey.format === KEY_FORMATS.ETHEREUM_ADDRESS) {
                  privateKey = ECKey.fromKey(privateKeyInfo);
                  publicKey = didPublicKey.publicKey;
                  signer = new ES256KRecoverableSigner();
                  verifier = new ES256KRecoverableVerifier();
                } else {
                  privateKey = ECKey.fromKey(privateKeyInfo);
                  publicKey = ECKey.fromKey(publicKeyInfo);
                  signer = new ECSigner();
                  verifier = new ECVerifier();
                }
                break;
              }
              case KTYS.OKP: {
                privateKey = OKP.fromKey(privateKeyInfo);
                publicKey = OKP.fromKey(publicKeyInfo);
                signer = new OKPSigner();
                verifier = new OKPVerifier();
                break;
              }
              default: {
                continue;
              }
            }

            if (
              checkKeyPair(
                privateKey,
                publicKey,
                signer,
                verifier,
                didPublicKey.alg
              )
            ) {
              this.signing_info_set.push({
                alg: didPublicKey.alg,
                kid: didPublicKey.id,
                key: key,
                format: KEY_FORMATS[key_format as keyof typeof KEY_FORMATS],
              });
              return didPublicKey.id;
            }
          } catch (err) {
            continue;
          }
        }
      }
      throw new Error(ERRORS.NO_PUBLIC_KEY);
    } catch (err) {
      throw err;
    }
  }

  /**
   * @param {string} kid - kid value of the SigningInfo which needs to be removed from the list
   * @remarks This method is used to remove a certain SigningInfo (key) which has the given kid value from the list.
   */
  removeSigningParams(kid: string) {
    try {
      this.signing_info_set = this.signing_info_set.filter((s) => {
        return s.kid !== kid;
      });
    } catch (err) {
      throw err;
    }
  }

  /**
   * @param {string} request - A DID SIOP request
   * @param {any} op_metadata  - SIOP(OpenIdConnect Provider) metadata: refer core/globals/SIOP_METADATA_SUPPORTED
   * https://openid.net/specs/openid-connect-self-issued-v2-1_0.html#name-static-self-issued-openid-p
   * @param {DidResolver[]} [resolvers] - Array of Resolvers (Derived from DidResolver) to be used for DID resolution
   * @returns {Promise<JWT.JWTObject>} - A Promise which resolves to a decoded request JWT
   * @remarks This method is used to validate requests coming from Relying Parties.
   */
  async validateRequest(
    request: string,
    op_metadata?: any,
    resolvers?: DidResolver[]
  ): Promise<JWTObject> {
    try {
      let resolversToValidate: any = undefined;
      if (resolvers && resolvers.length > 0) resolversToValidate = resolvers;
      else if (this.resolvers && this.resolvers.length > 0)
        resolversToValidate = this.resolvers;

      return DidSiopRequest.validateRequest(
        request,
        op_metadata,
        resolversToValidate
      );
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * @param {any} requestPayload - Payload of the request JWT for which a response needs to be generated
   * @param {number} expiresIn - Number of miliseconds under which the generated response is valid. Relying Parties can
   * either consider this value or ignore it
   * @returns {Promise<string>} - A Promise which resolves to an encoded DID SIOP response JWT
   * @remarks This method is used to generate a response to a given DID SIOP request.
   */
  async generateResponse(
    requestPayload: any,
    expiresIn: number = 1000
  ): Promise<string> {
    try {
      if (this.signing_info_set.length > 0) {
        let signing_info =
          this.signing_info_set[
            Math.floor(Math.random() * this.signing_info_set.length)
          ];

        if (this.identity.isResolved()) {
          return await DidSiopResponse.generateResponse(
            requestPayload,
            signing_info,
            this.identity,
            expiresIn
          );
        } else {
          return Promise.reject(new Error(ERRORS.UNRESOLVED_IDENTITY));
        }
      }
      return Promise.reject(new Error(ERRORS.NO_SIGNING_INFO));
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /**
   * @param {any} requestPayload - Payload of the request JWT for which a response needs to be generated
   * @param {number} expiresIn - Number of miliseconds under which the generated response is valid. Relying Parties can
   * either consider this value or ignore it
   * @param {vps} VPData - This contains the data for vp_token and additional info to send via id_token (_vp_token)
   * @returns {Promise<SIOPTokensEcoded>} - A Promise which resolves to a SIOPTokensEcoded
   * @remarks This method is used to generate a response to a given DID SIOP request which includes VP Data.
   */
  async generateResponseWithVPData(
    requestPayload: any,
    expiresIn: number = 1000,
    vps: VPData
  ): Promise<SIOPTokensEcoded> {
    try {
      if (this.signing_info_set.length > 0) {
        let signing_info =
          this.signing_info_set[
            Math.floor(Math.random() * this.signing_info_set.length)
          ];

        if (this.identity.isResolved()) {
          return await DidSiopResponse.generateResponseWithVPData(
            requestPayload,
            signing_info,
            this.identity,
            expiresIn,
            vps
          );
        } else {
          return Promise.reject(new Error(ERRORS.UNRESOLVED_IDENTITY));
        }
      }
      return Promise.reject(new Error(ERRORS.NO_SIGNING_INFO));
    } catch (err) {
      return Promise.reject(err);
    }
  }
  /**
   * @param {string} errorMessage - Message of a specific SIOPErrorResponse
   * @returns {string} - Encoded SIOPErrorResponse object
   * @remarks This method is used to generate error responses.
   */
  generateErrorResponse(errorMessage: string): string {
    try {
      return ErrorResponse.getBase64URLEncodedError(errorMessage);
    } catch (err) {
      throw err;
    }
  }
}
