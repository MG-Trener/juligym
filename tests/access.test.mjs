import test from 'node:test';
import assert from 'node:assert/strict';
import {passwordMatches,issueAccess,validAccess} from '../api/access.mjs';
test('shared password is case-sensitive and rejects invalid values',async()=>{
 const password=process.env.JULIGYM_PASSWORD;
 if(password){assert.equal(await passwordMatches(password),true);assert.equal(await passwordMatches(password.toLowerCase()),false);assert.equal(await passwordMatches(password+' '),false);}
 for(const p of ['wrong',null,{},'x'.repeat(129)])assert.equal(await passwordMatches(p),false);
});
test('access expires and cannot be forged or used with a different server key',()=>{
 const key='test-server-key',now=Date.now(),{token,expiresAt}=issueAccess(key,now);
 assert.equal(validAccess('Bearer '+token,key,now),true);
 for(const value of [null,'','Basic '+token,'Bearer '+token+'x','Bearer v1.e30.bad','Bearer '+token+'.extra'])assert.equal(validAccess(value,key,now),false);
 assert.equal(validAccess('Bearer '+token,'different',now),false);
 assert.equal(validAccess('Bearer '+token,key,expiresAt),false);
 const parts=token.split('.');parts[1]=Buffer.from(JSON.stringify({scope:'juli-diary',exp:Math.floor(now/1000)+86400})).toString('base64url');assert.equal(validAccess('Bearer '+parts.join('.'),key,now),false);
});
