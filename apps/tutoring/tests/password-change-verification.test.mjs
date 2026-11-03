import test from 'node:test';
import assert from 'node:assert/strict';
import {AuthService} from '../dist/features/auth/service.js';
test('normal password change cannot bypass current-password verification or silently use recovery',async()=>{
 const calls=[];const repo={changePassword:async(...args)=>calls.push(args),resetPassword:async()=>{throw Error('Normal change cannot use recovery');}};
 const service=new AuthService(repo),body={token:'verified-token',email:'fixture@isolated.invalid',new_password:'NewStrongPassword2!'};
 await assert.rejects(()=>service.changePassword(body),/CURRENT_PASSWORD_REQUIRED/);assert.equal(calls.length,0);
 await service.changePassword({...body,current_password:'OldStrongPassword1!'});assert.equal(calls.length,1);assert.equal(calls[0][2],'OldStrongPassword1!');
 const unsupported=new AuthService({resetPassword:repo.resetPassword});await assert.rejects(()=>unsupported.changePassword({...body,current_password:'OldStrongPassword1!'}),/PASSWORD_VERIFICATION_UNAVAILABLE/);
});
