import {test} from 'node:test';
import assert from 'node:assert/strict';
import {portalDeliveryStatus} from '../dist/features/students/portalDeliveryStatus.js';
test('portal delivery distinguishes acceptance, receipt, rejection and uncertain outcomes',()=>{
 assert.equal(portalDeliveryStatus({status:'sent'}),'accepted');
 assert.equal(portalDeliveryStatus({status:'sent'},'delivered'),'delivered');
 assert.equal(portalDeliveryStatus({status:'sent'},'failed'),'failed');
 assert.equal(portalDeliveryStatus({status:'failed',error_message:'PORTAL_NOT_SENT'}),'not_sent');
 assert.equal(portalDeliveryStatus({status:'failed',error_message:'PORTAL_OUTCOME_UNKNOWN'}),'unknown');
 assert.equal(portalDeliveryStatus({status:'failed',error_message:'legacy error'}),'unknown');
 assert.equal(portalDeliveryStatus({status:'queued'}),'queued');
});
