import {test} from 'node:test';
import assert from 'node:assert/strict';
import {totals,approve} from '../dist/domain.mjs';
const fixture=()=>({id:'checkout-12345678',status:'awaiting_approval',productId:'p1',quantity:2,shippingId:'standard',totals:totals('p1',2,'standard'),expiresAt:2000});
test('final total includes shipping and demo tax in integer cents',()=>assert.deepEqual(totals('p1',2,'standard'),{currency:'USD',subtotal:25800,shipping:500,tax:2104,total:28404}));
test('draft subtotal does not pretend shipping or taxes are final',()=>assert.equal(totals('p1',1,null).total,12900));
test('invalid cart inputs are rejected',()=>{for(const q of [0,-1,11,1.5,NaN])assert.throws(()=>totals('p1',q,'standard'));assert.throws(()=>totals('missing',1,'standard'));assert.throws(()=>totals('p1',1,'missing'));});
test('approval rejects stale or changed quotes',()=>{assert.throws(()=>approve(fixture(),28404,2001),/expired/);assert.throws(()=>approve(fixture(),1,1000),/changed/);const c=fixture();c.totals.total=1;assert.throws(()=>approve(c,1,1000),/changed/);});
test('approval requires review state and repeated approval preserves order',()=>{assert.throws(()=>approve({...fixture(),status:'draft'},28404,1000),/not ready/);const order=approve(fixture(),28404,1000);assert.equal(order.status,'confirmed');assert.equal(order.payment_status,'simulated');assert.strictEqual(approve(order,28404,1000),order);});
