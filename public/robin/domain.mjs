export const products = [
 {id:'p1',name:'Everyday Headphones',category:'Audio',price:12900,color:'Sage',kind:'headphones',tone:'#dce5d9',tag:'Our pick',description:'A little more focus. A lot less noise. Wireless over-ear headphones with soft cushions and up to 40 hours of listening.'},
 {id:'p2',name:'Pocket Speaker',category:'Audio',price:6900,color:'Terracotta',kind:'speaker',tone:'#edd8ca',tag:'Travel ready',description:'Big sound, small footprint. A portable wireless speaker made for slow mornings and spontaneous weekends.'},
 {id:'p3',name:'Studio Headphones',category:'Audio',price:18900,color:'Charcoal',kind:'headphones',tone:'#dddcd8',tag:'Premium sound',description:'Immersive sound and a comfortable fit, with active noise cancellation and a beautifully balanced listening experience.'},
 {id:'p4',name:'Daybreak Backpack',category:'Everyday',price:8900,color:'Sand',kind:'bag',tone:'#eee5d3',tag:'Everyday essential',description:'Everything in its place. A lightweight everyday bag with a padded laptop sleeve and thoughtful storage.'},
 {id:'p5',name:'Quiet Desk Lamp',category:'Home',price:7900,color:'Forest',kind:'lamp',tone:'#dbe1d7',tag:'Make room',description:'A softer light for your space. Adjustable, warm illumination for reading, working, and winding down.'},
 {id:'p6',name:'Move Water Bottle',category:'Everyday',price:3400,color:'Clay',kind:'bottle',tone:'#efded5',tag:'On the go',description:'Keep your day flowing. An insulated stainless steel bottle with a leakproof lid and an easy-carry shape.'}
];
export const shippingOptions = [
 {id:'standard',name:'Standard delivery',days:'5–7 business days',price:500,group:'economy'},
 {id:'economy',name:'Economy delivery',days:'7–10 business days',price:300,group:'economy'},
 {id:'express',name:'Express delivery',days:'2–3 business days',price:1200,group:'express'},
 {id:'nextday',name:'Next-day delivery',days:'1 business day',price:2200,group:'express'},
 {id:'weekend',name:'Weekend delivery',days:'Next available weekend',price:1500,group:'scheduled'},
 {id:'scheduled',name:'Scheduled delivery',days:'Within 7 business days',price:1800,group:'scheduled'}
];
export const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value/100);
export function totals(productId, quantity, shippingId) {
 const product=products.find(p=>p.id===productId), shipping=shippingOptions.find(s=>s.id===shippingId);
 if(!product || !Number.isInteger(quantity) || quantity<1 || quantity>10) throw new Error('Invalid product or quantity');
 if(shippingId && !shipping) throw new Error('Invalid shipping option');
 const subtotal=product.price*quantity, fee=shipping?.price||0;
 const tax=shipping ? Math.round((subtotal+fee)*0.08):0;
 return {currency:'USD',subtotal,shipping:fee,tax,total:subtotal+fee+tax};
}
export function approve(checkout, approvedTotal, now=Date.now()) {
 if(checkout.status==='confirmed') return checkout;
 if(checkout.status!=='awaiting_approval') throw new Error('Checkout is not ready for approval');
 if(now>checkout.expiresAt) throw new Error('This quote expired. Return to delivery to refresh it.');
 const amount=totals(checkout.productId,checkout.quantity,checkout.shippingId);
 if(amount.total!==approvedTotal || amount.total!==checkout.totals.total) throw new Error('The total changed. Review your quote again.');
 return {...checkout,status:'confirmed',payment_status:'simulated',order_id:`DEMO-${checkout.id.slice(-8).toUpperCase()}`,totals:amount};
}
