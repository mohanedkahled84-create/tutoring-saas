import {z} from 'zod';
import {isPayDate} from './payroll.js';

const date=z.string().refine(isPayDate);
export const collectionQuery=z.object({
 group_id:z.uuid().optional(),student_id:z.uuid().optional(),q:z.string().trim().max(100).optional(),
 from:date.optional(),to:date.optional(),page:z.coerce.number().int().min(1).max(10000).optional(),
}).strict();
export const collectionInput=z.object({
 group_id:z.uuid(),student_id:z.uuid(),request_id:z.uuid(),
 amount:z.number().finite().positive().max(100000000).refine(v=>Math.abs(v*100-Math.round(v*100))<0.000001),
 payment_method:z.enum(['cash','instapay','vodafone_cash','bank_transfer','other']),
 note:z.string().trim().max(1000).default(''),
}).strict();
export const voidCollectionInput=z.object({reason:z.string().trim().min(3).max(1000)}).strict();
