import { it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openAppUrl } from '../app/components/open-app.ts';
const original = globalThis.window;
const target='https://module.test/?a=1&b=2';
function install(open) {
 const calls=[];
 const location={href:'https://hub.test/'};
 globalThis.window={location,open:(...args)=>{calls.push(args);return open(...args);}};
 return {calls,location};
}
afterEach(()=>{if(original===undefined)delete globalThis.window;else globalThis.window=original;});
it('new tab has no opener and does not navigate Hub',()=>{
 const popup={closed:false,opener:{}};
 const {calls,location}=install(()=>popup);
 openAppUrl(target);
 assert.deepEqual(calls,[[target,'_blank']]);
 assert.equal(popup.opener,null);assert.equal(location.href,'https://hub.test/');
});
it('a null popup handle falls back to the original tab',()=>{
 const {location}=install(()=>null);openAppUrl(target);assert.equal(location.href,target);
});
it('a closed popup handle falls back',()=>{
 const {location}=install(()=>({closed:true}));openAppUrl(target);assert.equal(location.href,target);
});
it('an exception from window.open falls back',()=>{
 const {location}=install(()=>{throw new Error('BLOCKED');});openAppUrl(target);assert.equal(location.href,target);
});
it('a rejected opener write closes the unsafe tab before falling back',()=>{
 let closed=false;const popup={closed:false,close(){closed=true;}};
 Object.defineProperty(popup,'opener',{set(){throw new Error('DENIED');}});
 const {location}=install(()=>popup);openAppUrl(target);assert.ok(closed);assert.equal(location.href,target);
});
it('an ignored opener write also closes the unsafe tab',()=>{
 let closed=false;const popup={closed:false,close(){closed=true;}};
 Object.defineProperty(popup,'opener',{set(){},get(){return {};}});
 const {location}=install(()=>popup);openAppUrl(target);assert.ok(closed);assert.equal(location.href,target);
});
for(const value of ['javascript:alert(1)','data:text/html,hello'])it('rejects unsafe module protocol '+value.split(':')[0],()=>{
 const {calls,location}=install(()=>null);
 assert.throws(()=>openAppUrl(value),/HTTP or HTTPS/);assert.equal(calls.length,0);assert.equal(location.href,'https://hub.test/');
});
