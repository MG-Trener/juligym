import {createHmac,randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
const salt='6a15f7f16373c9d54978284906fa4d56';
const expected=Buffer.from('b97e23c54d4a73d5d1c362011ad936cb45096d3f2e084c5c5fcf2291a62e91dd','hex');
const lifetime=8*60*60;
export async function passwordMatches(value){
 if(typeof value!=='string'||value.length>128)return false;
 return timingSafeEqual(await derive(value,salt,32),expected);
}
function sign(value,secret){
 if(!secret)throw Error('Access signing key unavailable');
 const key=createHmac('sha256',secret).update('juligym/access/v1').digest();
 return createHmac('sha256',key).update(value).digest();
}
export function issueAccess(secret,now=Date.now()){
 const exp=Math.floor(now/1000)+lifetime;
 const body=Buffer.from(JSON.stringify({scope:'juli-diary',exp,nonce:randomBytes(16).toString('hex')})).toString('base64url');
 const value='v1.'+body;
 return {token:value+'.'+sign(value,secret).toString('base64url'),expiresAt:exp*1000};
}
export function validAccess(header,secret,now=Date.now()){
 try{
  if(typeof header!=='string'||header.length>512||!header.startsWith('Bearer '))return false;
  const [version,body,signature,extra]=header.slice(7).split('.');
  if(version!=='v1'||!body||!signature||extra!==undefined||!secret)return false;
  const supplied=Buffer.from(signature,'base64url'),expected=sign(version+'.'+body,secret);
  if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return false;
  const value=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
  return value.scope==='juli-diary'&&Number.isInteger(value.exp)&&value.exp>Math.floor(now/1000)&&value.exp<=Math.floor(now/1000)+lifetime;
 }catch{return false;}
}
