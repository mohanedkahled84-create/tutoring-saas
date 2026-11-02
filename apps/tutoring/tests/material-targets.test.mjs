import test from 'node:test';
import assert from 'node:assert/strict';
import {materialGroupsSchema,materialMatchesGroups,normalizeMaterialGroups} from '../dist/features/materials/targets.js';
import {renderMaterialGroupPicker,materialInGroup,materialGroupLabel} from '../../web/src/components/MaterialGroupPicker.js';

const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002',c='10000000-0000-4000-8000-000000000003';
test('Explicit material targets never become tenant-wide; membership in any selected group grants one assignment',()=>{
 assert.equal(materialMatchesGroups({group_ids:[]},[a]),false);
 assert.equal(materialMatchesGroups({group_id:a,group_ids:[a,b]},[c]),false);
 assert.equal(materialMatchesGroups({group_id:a,group_ids:[a,b]},[b]),true);
 assert.equal(materialMatchesGroups({group_id:a},[b]),false);
 assert.equal(materialMatchesGroups({group_id:null},[b]),true);
 assert.deepEqual(normalizeMaterialGroups({group_ids:[a,b,a]}),{group_id:a,group_ids:[a,b]});
 for(const input of [{group_ids:[]},{group_ids:['forged']},{group_ids:[b],group_id:a}])assert.equal(materialGroupsSchema.safeParse(input).success,false);
 assert.equal(materialGroupsSchema.safeParse({group_ids:Array(201).fill(a)}).success,false);
});
test('Group picker makes all-future-groups explicit, escapes names and shares filtering semantics',()=>{
 const groups=[{id:a,name:'<img src=x onerror=alert(1)>'},{id:b,name:'مجموعة الثلاثاء'}];
 const markup=renderMaterialGroupPicker('fixturePicker',groups,[a,b]);
 assert.ok(!markup.includes('<img src=x'));assert.ok(markup.includes('&lt;img'));
 assert.ok(markup.includes('min-height:44px'));assert.ok(markup.includes('aria-live="polite"'));
 assert.ok(markup.includes('المجموعات المضافة لاحقًا'));
 assert.equal(materialInGroup({group_ids:[a,b],group_id:a},b),true);
 assert.equal(materialInGroup({group_ids:[a,b],group_id:a},c),false);
 assert.equal(materialGroupLabel({group_ids:[b]},groups),'مجموعة الثلاثاء');
});
