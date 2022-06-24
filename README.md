# did-siop #

## Availability ##
* [For Node](https://www.npmjs.com/package/did-siop)
* [For Browser](https://cdn.jsdelivr.net/npm/did-siop@2.0.3/dist/browser/did-siop.min.js)

## Overview ##
This implements _Self Issued OpenId Connect Provider (SIOP) V2_. The library contains two components, **RP (Relying Party)** and **Provider**. Provider is intended to be use inside any piece of software which will provide DID SIOP authentication (Identity Wallet) and RP can be used by relying parties (client applications) to employ DID SIOP authentication. This library can be used in both client-side (browser) and server-side (Node.js) applications.

Following are the primary specifications followed by this implementation.
* [Self-Issued OpenID Provider v2](https://openid.net/specs/openid-connect-self-issued-v2-1_0.html)
* [OpenID Connect for Verifiable Presentations](https://openid.net/specs/openid-connect-4-verifiable-presentations-1_0.html)

## Capabiltities ##
### Static SIOP Discovery Metadata ###
By defalut, library uses [specified](https://openid.net/specs/openid-connect-self-issued-v2-1_0.html#name-static-self-issued-openid-p) Discovery metadata, but also provides a mechanism to use custom values.

#### Initialise RP with Metadata ####
```js
        // get default set of metadata
        let temp_md:SiopMetadataSupported = {...SIOP_METADATA_SUPPORTED}
        // set scopes to "openid" only
        temp_md.scopes = ["openid" "did_authn"];

        let keyResolv2018 = new KeyDidResolver('key', CRYPTO_SUITES.Ed25519VerificationKey2018);
        let siop_rp = await RP.getRP(
            redirect_uri, // RP's redirect_uri
            DID_TEST_RESOLVER_DATA_NEW[3].did, // RP's did
            registration,
            temp_md, // use custom Metadata to initialise the RP
            [keyResolv2018]
        )

```
#### Validate Metadata ####
```js
        // get default set of metadata
        let temp_md:SiopMetadataSupported = {...SIOP_METADATA_SUPPORTED}

        // set scopes to "openid" only
        temp_md.scopes = ["openid];

        // use the new metadata set to validate the request
        let validityPromise =  DidSiopRequest.validateRequest(requests.good.requestGoodEmbeddedJWT,temp_md);

```

### DID Resolvers ###
Version 2 of did-siop provides mechanism to use custom DID Resolvers. Currently resolvers for following DID Methods are built in, but developers have the option to write thier own resolvers.

- EthrDidResolver [did:ethr](https://github.com/RadicalLedger/did-siop-lib/blob/dev/src/core/Identity/Resolvers/did_resolver_ethr.ts) 
- KeyDidResolver [did:key](https://github.com/RadicalLedger/did-siop-lib/blob/dev/src/core/Identity/Resolvers/did_resolver_key.ts)
- UniversalDidResolver [did:*](https://github.com/RadicalLedger/did-siop-lib/blob/dev/src/core/Identity/Resolvers/did_resolver_uniresolver.ts) - DID Methods supported by https://dev.uniresolver.io/

To build a custom resolver to use with DID-SIOP, derive your custom resolver from [DidResolver](https://github.com/RadicalLedger/did-siop-lib/blob/dev/src/core/Identity/Resolvers/did_resolver_base.ts) and override the __resolveDidDocumet__ appropriately.

#### Crypto Suites ####
When using/building a resolver, the library provide the option of specifying a __Crypto Suite__ to be used in resolving DIDs. Relevant Crypto Suite can be passed as an argument when constructing the DIDResolver.
```js
        let keyResolv2018 = new KeyDidResolver('key', CRYPTO_SUITES.Ed25519VerificationKey2018);
        let siop_rp = await RP.getRP(
            redirect_uri, // RP's redirect_uri
            DID_TEST_RESOLVER_DATA_NEW[3].did, // RP's did
            registration,
            undefined,
            [keyResolv2018]
        )
```
DID-SIOP has been tested the KeyDidResolver using following Crypto-Suites.
- @digitalbazaar/ed25519-verification-key-2018
- @digitalbazaar/ed25519-verification-key-2020

## Special Data Structures ##
#### VPData ####
When generating a response with __Provider.generateResponseWithVPData__, matching Presentation Data for the vp_data parameter of Claims will be submitted using this data structure.
```js
export interface VPData{
    vp_token: any;  // JSON object with VP related data
    _vp_token: any; // JSON object wit VP request related info
}
```
#### SIOPTokensEcoded ####
When generating a response with __Provider.generateResponseWithVPData__ , data is returned using this data structure. Both ID_Token and VP_Token are presended as Base64 encoded JWTs

```js
export interface SIOPTokensEcoded {
    id_token: string; // Base64 encoded JWT
    vp_token: string; // Base64 encoded JWT
}
```
#### SIOPTokenObjects ####
When validating a response with __Provider.validateResponseWithVPData__ , method returns using this data structure. Both ID_Token and VP_Token are presended as JWTs

```js
export interface SIOPTokenObjects {
    id_token: any; // Decoded Object
    vp_token: any; // Decoded Object
}
```

## Usage ##

Sample illustrating the usage of basic funcitons of [did-siop](https://github.com/RadicalLedger/did-siop-lib/tree/master) library can be found [here](https://github.com/RadicalLedger/siop-auth-sample)


### RP ###
```js
    //Request Generation
    var request;
    siop_rp = await DID_SIOP.RP.getRP(
        'localhost:5001/home', // RP's redirect_uri
        'did:ethr:rinkeby:0x02be73dcaa2013a714b6745f54ff8576df151f8226cc3923538bfbfb9a014584fe', // RP's did
        {
            "jwks_uri": "https://uniresolver.io/1.0/identifiers/did:example:0xab;transform-keys=jwks",
            "id_token_signed_response_alg": ["ES256K", "EdDSA", "RS256"]
        }
    )
    console.log('Got RP instance ....');
    siop_rp.addSigningParams(
        'c4873e901915343baf7302b0b87bae70bf5726e9280d415b3f7fc85908cc9d5a', // Private key
        'did:ethr:rinkeby:0x02be73dcaa2013a714b6745f54ff8576df151f8226cc3923538bfbfb9a014584fe#controller', // Corresponding authentication method in RP's did document (to be used as kid value for key)
        DID_SIOP.KEY_FORMATS.HEX, //Format in which the key is supplied. List of values is given below
        DID_SIOP.ALGORITHMS['ES256K']
    );

    console.log('RP SigningParams added ...');
    request = await siop_rp.generateRequest();

    console.log('Request generated ...', request);

    //Response validation
    const validateResponse = async () => {
      console.log("onRP");
      let keyResolv2020 = new SIOP.Resolvers.KeyDidResolver('key', "@digitalbazaar/x25519-key-agreement-key-2018")          
      let siop_rp = await SIOP.RP.getRP(
        'localhost:4200/home', // RP's redirect_uri
        'did:key:z6MkvEoFWxZ9B5RDGSTLo2MqE3YJTxrDfLLZyZKjFRtcUSyw', // RP's did
        {
        "id_token_signed_response_alg": ["ES256K","ES256K-R", "EdDSA", "RS256"]},
        undefined,
        [keyResolv2020]
        );

      console.log(siop_rp);

      siop_rp.addSigningParams(
        'zrv1xdp8ZsfXSDh4fQp8sE2VYPmLiCL3RssjKeXW7fYrRkxyWpWR5ugcC36WrCx9FizbJvxdwFmYcq7YxRVC2nVPFp5', // Private key
        'did:key:z6MkvEoFWxZ9B5RDGSTLo2MqE3YJTxrDfLLZyZKjFRtcUSyw#z6MkvEoFWxZ9B5RDGSTLo2MqE3YJTxrDfLLZyZKjFRtcUSyw', // Corresponding authentication method in RP's did document (to be used as kid value for key)
        SIOP.KEY_FORMATS.BASE58, //Format in which the key is supplied. List of values is given below
        SIOP.ALGORITHMS['EdDSA']);

        console.log('RP SigningParams added ...');
        let valid = await siop_rp.validateResponse(props.response);
        console.log('Response validated ...', valid);
        setResponse(valid);
    }
```

### Provider ###
```js
    // Response Generation
    const DID_SIOP = require('did-siop');

    const generateResponse = async () => {
      const provider = new SIOP.Provider();          
      await provider.setUser("did:key:z6MkvEoFWxZ9B5RDGSTLo2MqE3YJTxrDfLLZyZKjFRtcUSyw");// User's did
      console.log('User DID set to Provider ...');
  
      provider.addSigningParams(
        'zrv1xdp8ZsfXSDh4fQp8sE2VYPmLiCL3RssjKeXW7fYrRkxyWpWR5ugcC36WrCx9FizbJvxdwFmYcq7YxRVC2nVPFp5', // User's private key
        'did:key:z6MkvEoFWxZ9B5RDGSTLo2MqE3YJTxrDfLLZyZKjFRtcUSyw#z6MkvEoFWxZ9B5RDGSTLo2MqE3YJTxrDfLLZyZKjFRtcUSyw', // Corresponding authentication method in user's did document (to be used as kid value for key)
        SIOP.KEY_FORMATS.BASE58, //Format in which the key is supplied. List of values is given below
        SIOP.ALGORITHMS['EdDSA']
        );// If several keys are provided, one will be selected randomly when generating the request. To remove a key use provider.removeSigningParams(kid)
      
      console.log('User SigningParams added ...');

      // Request validation and response generation
      console.log("props.request=>>", props.request)
      provider.validateRequest(props.request).then(async (decodedRequest) => {
          console.log('Request validation completed ...');
          console.log('decodedRequest',decodedRequest);
          let jwtExpiration = 5000;
          try {
          await provider.generateResponse(decodedRequest.payload, jwtExpiration).then(responseJWT => {
              console.log('Response generated ...');
              console.log('responseJWT',responseJWT);
        })
      }
      catch (err){
          console.log("ERROR provider.generateResponse  " , err);
      }
      })
      .catch((err) => {
        console.log("ERROR invalid request" , err);
      })              
    }

```

### Supported Algorithms ###
Defined in _src/core/globals.ts_
* RS256, RS384, RS512
* PS256, PS384, PS512
* ES256, ES384, ES512, ES256K, ES256K-R, EdDSA

### Supported Key Formats ###
Defined in _src/core/globals.ts_
* PKCS8_PEM, PKCS1_PEM
* HEX, BASE58, BASE64

## Classes & Methods ##

### Provider ###
This class provides primary functionality to for Self Issued OpenIDConnect Provider.

---
#### async setUser(did: string, doc?: DidDocument) ####
* Parameters
  * did:string - fully qualified decentralised identity of the user
  * doc?:DidDocument - Complete DID Document for the user [Optional]
* Return
  * void

Sets the user of the application. If the DID is provied, this function resolves the provided did to a DID Document

---
#### addSigningParams(key: string): string ####
Add necessary parameters for the user to cryptographically sign a message
* Parameters
  * key:string - Private Key of the user. Should match with one of the Keys provided in DID Document
* Return
  * KID of the related public key in DID Document

---
#### removeSigningParams(kid: string) ####
Removes an already added key information
* Parameters
  * kid:string - Key ID of the key to be removed
* Return
  * void

---
#### async validateRequest(request: string): Promise\<DID_SIOP.JWTObject\> ####
* Parameters
  * request:string - Authentication request from relying party to sign in
* Return
  * Promise\<DID_SIOP.JWTObject\>

---
#### async generateResponse(requestPayload: any, expiresIn: number = 1000): Promise\<string\> ####
* Parameters
  * requestPayload:any - payload of the request JWT
  * expiresIn:number - expiration time in seconds
* Return
  * Promise\<string\>
---

#### async generateResponseWithVPData(requestPayload: any, expiresIn: number = 1000, vps:VPData ): Promise\<string\> ####
* Parameters
  * requestPayload:any - payload of the request JWT
  * expiresIn:number - expiration time in seconds
  * vps:VPData - Verifiable Presentation Data as JSON Object
* Return
  * Promise\<SIOPTokensEcoded\>
---

#### generateErrorResponse(errorMessage: string): Promise\<string\> ####
* Parameters
  * errorMessage:string - Message part of any error generated by ***validateRequest(request: string)*** method. A set of possible errors is provided in ***DID_SIOP.ERROR_RESPONSES*** constant. Error object can be accessed with ***DID_SIOP.ERROR_RESPONSES.\<specific_error\>.err***.
* Return
  * Promise\<string\> (Base64URL encoded)

### RP ###

---
#### static async getRP(redirect_uri: string, did: string, registration: any, did_doc?: DidDocument): Promise\<RP\> ####
* Parameters
  * redirect_uri:string - redirection URL for the RP, this is where the user would be redirected with id_token once authenticated
  * did:string - fully qualified decentralised identity of the relying party
  * registration:any - registration meta data of the RP
  * doc?:DidDocument - Complete DID Document for the Relying Party [Optional]
* Return
  * Promise\<RP\>

---
#### addSigningParams(key: string): string ####
Add necessary parameters for the user to cryptographically sign a message
* Parameters
  * key:string - Private Key of the user. Should match with one of the Keys provided in DID Document
* Return
  * KID of the related public key in DID Document

---
#### removeSigningParams(kid: string) ####
Removes an already added key information
* Parameters
  * kid:string - Key ID of the key to be removed
* Return
  * void

---
#### async generateRequest(options:any = {}): Promise\<string\> ####
* Parameters
  * options:any = {} - Any additional options to include in the request as a JSON object
* Return
  * Promise\<string\>

---
#### async generateUriRequest(request_uri: string, options:any = {}): Promise\<string\> ####
* Parameters
  * request_uri:string - URI for the signed JWT token
  * options:any = {} - Any additional options to include in the request as a JSON object
* Return
  * Promise\<string\>

---
#### async validateResponse(response:string, checkParams: CheckParams = {redirect_uri: this.info.redirect_uri}): Promise\<DID_SIOP.JWTObject | DID_SIOP.SIOPErrorResponse\> ####
* Parameters
  * response:string - Received response as a string
  * checkParams: DID_SIOP.CheckParams - Parameters against which the response must be validated. redirect_uri is given by default. Other possible values are ***validBefore: number***, ***isExpirable: boolean*** and ***nonce: string***. Several others will be supported in future.
* Return
  * Promise\<DID_SIOP.JWTObject | DID_SIOP.SIOPErrorResponse\>
* Notes
  * If you use nonce in the request, you must include the same nonce when validate the response. 

---
#### async validateResponseWithVPData(tokensEncoded: SIOPTokensEcoded, checkParams: CheckParams = {redirect_uri: this.info.redirect_uri}): Promise\<SIOPTokenObjects | DID_SIOP.SIOPErrorResponse\> ####
* Parameters
  * response:string - Received response as a string
  * checkParams: DID_SIOP.CheckParams - Parameters against which the response must be validated. redirect_uri is given by default. Other possible values are ***validBefore: number***, ***isExpirable: boolean*** and ***nonce: string***. Several others will be supported in future.
* Return
  * Promise\<DID_SIOP.SIOPTokenObjects | DID_SIOP.SIOPErrorResponse\>
* Notes
  * If you use nonce in the request, you must include the same nonce when validate the response. 


## Verifiable Presentations (VP) ##

### Request VPs ###
In the request, __vp_token__ attribute could appear within the claims attribute. This should have have the __presentation_definition__ attribute as a child element.

### VPs in Response ###
__vp_token__ will be included in the same response as ID Token and will be a separate element in the same level as ID Token. In this implementation, __vp_token__ is an Base64 encoded JWT.
Along with __vp_token__, there coudl be a _vp_token attribute inside the __id_token__. Purpose of this is to give an indication about what VPs were requested at the request. 

### Helper Functions ###

**validateRequestJWTClaims**
- Defined In : Claimd/Index.ts
- Input : Tokens (vp & id) as a SIOPTokensEcoded , each token is a Base64 encoded JWT
- Validation :  only the vp_token within the claim
- Return : Promise.resolve if success, reject otherwise

**generateResponseWithVPData**
- Defined In : core/Response.ts
- Input : Claims as a JSON object
- Validation :  only the vp_token within the claim
- Return : Promise<SIOPTokensEcoded>

**generateResponseVPToken**
- Defined In : core/Response.ts
- Input : requestPayload as a JSON object, vp_token & _vp_token as VPData
- Validation :  validate vp_token interally using validateResponseVPToken
- Return : Promise<string>, vp_token as string (Encoded JWT)

**validateResponseWithVPData**
- Defined In : Claimd/Index.ts
- Input : Tokens (vp & id) as a SIOPTokensEcoded , each token is a Base64 encoded JWT
- Validation :  Internally calls DidSiopResponse.validateResponse to validate the id_token
                Internally calls Claimd/Index.ts::validateResponseVPToken to validate the vp_token
- Return : Promise (true | SIOPErrorResponse)

**validateResponseVPToken**
- Defined In : Claimd/Index.ts
- Input : vp_token as a JSON object
- Validation :  look for verifiableCredential attribute within the vp_token
- Return : Promise.resolve if success, reject otherwise

**validateResponse_VPToken**
- Defined In : Claimd/Index.ts
- Input : _vp_token as a JSON object
- Validation :  validate whether the input param is a valid JSON object
- Return : Promise.resolve if success, reject otherwise

**validateResponseVPTokenJWT**
- Defined In : Claimd/Index.ts
- Input : vp_token as a JWT object
- Validation :  look for verifiableCredential attribute within the vp_token
- Return : Promise.resolve if success, reject otherwise  

### Hot Fix ###
chaneg following line in node_modules/ethr-did-resolver/lib/index.js (ln1087)
```
    // blockTag = qParams.get('versionId') ?? blockTag;
    blockTag = ((qParams.get('versionId') == null) || qParams.get('versionId') == undefined) ? blockTag : qParams.get('versionId');
```
