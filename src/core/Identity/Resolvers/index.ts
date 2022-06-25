import { DidDocument,ERRORS } from "../commons";
import { DidResolver } from "./did_resolver_base";
import { EthrDidResolver } from "./did_resolver_ethr";
import { KeyDidResolver } from "./did_resolver_key";
import { UniversalDidResolver } from "./did_resolver_uniresolver";


/**
 * @classdesc A Resolver class which combines several other Resolvers in chain.
 * A given DID is tried with each Resolver object and if fails, passed to the next one in the chain.
 * @property {any[]} resolvers - An array to contain instances of other classes which implement DidResolver class. 
 * @extends {DidResolver}
 */
class CombinedDidResolver extends DidResolver{
    private resolvers: any[] = [];

    /**
     * 
     * @param {any} resolver - A resolver instance to add to the chain.
     * @returns {CombinedDidResolver} To use in fluent interface pattern.
     * @remarks Adds a given object to the resolvers array.
     */
    addResolver(resolver: any): CombinedDidResolver{
        this.resolvers.push(resolver);
        return this;
    }

        /**
     * 
     * @returns {CombinedDidResolver} To use in fluent interface pattern.
     * @remarks Return currently available resolvers array.
     */
         getResolvers():any[]{
            return this.resolvers;
        }
    
    async resolveDidDocumet(did: string): Promise<DidDocument>{
        let doc: DidDocument | undefined;
        if (this.resolvers.length == 0){
            console.log("No resolvers found, adding uniresolver");
            let uniResolver = new UniversalDidResolver('uniresolver')
            this.addResolver(uniResolver);
        }
        for(let resolver of this.resolvers){
            try{
                doc = await resolver.resolve(did);
                if(!doc){
                    continue;
                }
                else{
                    return doc;
                }
            }
            catch(err){
                continue;
            }
        }
        throw new Error(ERRORS.DOCUMENT_RESOLUTION_ERROR);
    }

    /**
     * 
     * @param {string} did - DID to resolve the DID Document for.
     * @returns A promise which resolves to a {DidDocument}
     * @override resolve(did) method of the {DidResolver}
     * @remarks Unlike other resolvers this class can resolve Documents for many DID Methods.
     * Therefore the check in the parent class needs to be overridden.
     */
    resolve(did: string): Promise<DidDocument>{
        return this.resolveDidDocumet(did);
    }
}

/**
 *  @exports CombinedDidResolver An instance of CombinedResolver with no resolver added.
 */
export const combinedDidResolver = new CombinedDidResolver('all');

export {CombinedDidResolver,KeyDidResolver, EthrDidResolver,UniversalDidResolver}
