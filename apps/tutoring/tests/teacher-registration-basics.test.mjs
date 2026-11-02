import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationBasics} from '../dist/features/auth/registrationBasics.js';
import {renderAuthScreens} from '../../web/src/components/AuthScreens.js';

test('teacher registration accepts several stages, requires other-stage detail and rejects unknown stages',()=>{
 const base={registration_version:2,subject:' الفيزياء ',education_stages:['preparatory','secondary','secondary']};
 assert.deepEqual(registrationBasics(base),{subject:'الفيزياء',education_stages:['preparatory','secondary'],other_stage:''});
 for(const input of [{...base,education_stages:[]},{...base,subject:''},{...base,education_stages:['university']},{...base,education_stages:['other']},{...base,education_stages:'secondary'}])assert.throws(()=>registrationBasics(input),e=>e.code==='INVALID_REGISTRATION_BASICS');
 assert.equal(registrationBasics({...base,education_stages:['other'],other_stage:'تعليم جامعي'}).other_stage,'تعليم جامعي');
 assert.deepEqual(registrationBasics({subject:'legacy'}),{},'cached clients keep their compatible registration contract');
});
test('current registration asks for teaching basics without mandatory group, student or platform setup',()=>{
 const html=renderAuthScreens(),signup=html.slice(html.indexOf('id="formSignup"'),html.indexOf('</form>',html.indexOf('id="formSignup"')));
 assert.match(signup,/id="signupSubject"[^>]*required/);assert.match(signup,/name="signupStage"/);assert.match(signup,/يمكنك اختيار أكثر من مرحلة/);
 assert.doesNotMatch(signup,/id="(?:group|student|platform)/i);
 assert.match(signup,/for="signupSubject"/);assert.match(signup,/for="signupOtherStage"/);
});
