/** SERVER ONLY. Never import this module from dist/.
 * Prepared against https://docs.reap.global/agentic-payments/overview
 * Not deployed by the current static host. No endpoint is exposed to browsers.
 * A future authenticated backend must derive owner IDs from the signed-in user,
 * check ownership of every resource, persist idempotency keys and enforce budgets.
 */
const SANDBOX_HOSTS=new Set(['https://sandbox.api.reap.global','https://sg.sandbox.api.reap.global']);
const resourceId=id=>{if(typeof id!=='string'||!/^[-a-zA-Z0-9_]+$/.test(id))throw Error('Invalid resource ID');return id;};
const requireKey=key=>{if(typeof key!=='string'||!key.trim()||/[\r\n]/.test(key))throw Error('Persist an Idempotency-Key for this operation');return key;};
function assertNoCardData(value){if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(/^(pan|cardNumber|card_number|cvc|cvv|securityCode)$/i.test(key))throw Error('Card data belongs on the REAP-hosted page');assertNoCardData(item);}}
export function readReapConfig(env={}){return {enabled:env.REAP_ENABLED==='true',baseUrl:env.REAP_BASE_URL||'',apiKey:env.REAP_API_KEY||'',version:env.REAP_VERSION||'',returnUrl:env.REAP_RETURN_URL||'',hostedOrigins:(env.REAP_HOSTED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean)};}
export class ReapClient {
 constructor(config,fetchImpl=globalThis.fetch){this.config=config;this.fetch=fetchImpl;}
 assertConfigured(){const c=this.config;if(!c.enabled)throw Error('REAP sandbox connection is not enabled');if(!SANDBOX_HOSTS.has(c.baseUrl))throw Error('Confirm the sandbox region/host; production is disabled');if(!c.apiKey||!c.version)throw Error('Missing server-side API key or Reap-Version');if(typeof this.fetch!=='function')throw Error('Fetch runtime required');}
 presentation(){let url;try{url=new URL(this.config.returnUrl);}catch{throw Error('Configure an HTTPS return URL');}if(url.protocol!=='https:'||url.username||url.password)throw Error('Configure an HTTPS return URL');return {type:'REDIRECT',returnUrl:url.href};}
 async request(method,path,body,extraHeaders={}){this.assertConfigured();assertNoCardData(body);const headers={Authorization:`Bearer ${this.config.apiKey}`,'Reap-Version':this.config.version,...extraHeaders};if(body!==undefined)headers['Content-Type']='application/json';const response=await this.fetch(this.config.baseUrl+path,{method,headers,redirect:'error',signal:AbortSignal.timeout(15000),...(body===undefined?{}:{body:JSON.stringify(body)})});if(!response.ok){const error=new Error(`REAP request failed (HTTP ${response.status}); no automatic retry was made`);error.status=response.status;throw error;}return response.json();}
 enroll({source,cardId,owner},key){if(!['REAP_CARD','BIN_SPONSOR','EXTERNAL'].includes(source))throw Error('Select a supported enrollment source');const body={source,presentation:this.presentation()};if(source!=='EXTERNAL')body.cardId=resourceId(cardId);if(source!=='REAP_CARD'){if(owner?.type!=='CLIENT_REFERENCE'||!owner.id||!owner.email)throw Error('Verified customer reference and email required');body.owner={type:owner.type,id:owner.id,email:owner.email};if(source==='BIN_SPONSOR'){if(!owner.name)throw Error('Cardholder name required');body.owner.name=owner.name;}}return this.request('POST','/agentic/enrollments',body,{'Idempotency-Key':requireKey(key)});}
 listEnrollments({ownerType,ownerId,cursor}){if(!['REAP_USER','CLIENT_REFERENCE'].includes(ownerType)||!ownerId)throw Error('Scope enrollment listing to the authenticated owner');const q=new URLSearchParams({ownerType,ownerId,limit:'20'});if(cursor)q.set('cursor',cursor);return this.request('GET','/agentic/enrollments?'+q);}
 getEnrollment(id){return this.request('GET','/agentic/enrollments/'+resourceId(id));}
 getMandate(id){return this.request('GET','/agentic/mandates/'+resourceId(id));}
 searchProducts({query,country='US',currency='USD',filters,pagination}){if(!query?.trim())throw Error('Search query required');return this.request('POST','/agentic/products/search',{query,context:{country,currency},...(filters?{filters}:{}),...(pagination?{pagination}:{})});}
 productDetails(productIds){if(!Array.isArray(productIds)||!productIds.length)throw Error('Product IDs required');return this.request('POST','/agentic/products/details',{productIds});}
 resolveVariant(productId,optionIds){return this.request('POST','/agentic/products/variant',{productId,optionIds});}
 createQuote({items,email,shippingAddress,offerCode},key){if(!Array.isArray(items)||!items.length||items.some(i=>!i.variantId||!Number.isInteger(i.quantity)||i.quantity<1))throw Error('Quote requires purchasable variant IDs and quantities');if(!email)throw Error('Customer email required');return this.request('POST','/agentic/quotes',{items:items.map(i=>({variantId:i.variantId,quantity:i.quantity})),email,...(shippingAddress?{shippingAddress}:{}),...(offerCode?{offerCode}:{})},{'Idempotency-Key':requireKey(key)});}
 getQuote(id){return this.request('GET','/agentic/quotes/'+resourceId(id));}
 selectShipping(id,shippingOptionId){return this.request('POST',`/agentic/quotes/${resourceId(id)}/shipping-option`,{shippingOptionId:resourceId(shippingOptionId)});}
 async createCheckout({quoteId,enrollmentId,approvedAmount},key,{simulateCompleted=false}={}){
 // Caller must check ownership, lock the quote and reserve budget in a transaction.
 // approvedAmount comes from a trusted approval record, never a browser total.
 requireKey(key);const enrollment=await this.getEnrollment(enrollmentId);if(enrollment.status!=='ACTIVE')throw Error('Enrollment is not ACTIVE');
 const quote=await this.getQuote(quoteId);if(!Number.isFinite(Date.parse(quote.expiresAt))||Date.parse(quote.expiresAt)<=Date.now())throw Error('Quote expired; request a fresh quote');
 const final=quote.amountBreakdown?.finalAmount;if(!final||!approvedAmount||final.currency!==approvedAmount.currency||String(final.amount)!==String(approvedAmount.amount))throw Error('Quote amount changed; renewed approval required');
 return this.request('POST','/agentic/checkouts',{quoteId:resourceId(quoteId),enrollmentId:resourceId(enrollmentId),presentation:this.presentation()},{'Idempotency-Key':key,...(simulateCompleted?{'X-Simulate-Checkout':'COMPLETED'}:{})});
 }
 getCheckout(id){return this.request('GET','/agentic/checkouts/'+resourceId(id));}
 hostedAction(resource){const action=resource.nextAction;if(!action)return null;if(action.type!=='REDIRECT')throw Error('Unsupported hosted action');const url=new URL(action.url);if(url.protocol!=='https:'||url.username||url.password||!this.config.hostedOrigins.includes(url.origin))throw Error('Confirm the REAP hosted origin before redirecting');if(action.expiresAt&&Date.parse(action.expiresAt)<=Date.now())throw Error('Hosted action expired');return url.href;}
}
