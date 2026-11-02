import {z} from 'zod';

export const materialGroupsSchema = z.object({
  group_id: z.string().uuid().nullable().optional(),
  group_ids: z.array(z.string().uuid()).min(1).max(200).nullable().optional(),
}).refine(value => !value.group_ids || !value.group_id || value.group_ids.includes(value.group_id), {
  message: 'المجموعة الأساسية يجب أن تكون ضمن المجموعات المختارة',
});

/** null is the existing tenant-wide assignment; an explicit empty list is never all. */
export function materialGroupIds(material: {group_id?:string|null;group_ids?:string[]|null}): string[]|null {
  if (Array.isArray(material.group_ids)) return [...new Set(material.group_ids)];
  return material.group_id ? [material.group_id] : null;
}

export function materialMatchesGroups(material: {group_id?:string|null;group_ids?:string[]|null}, groups:Iterable<string>):boolean {
  const targets=materialGroupIds(material);
  if (targets===null) return true;
  const memberships=new Set(groups);
  return targets.some(id=>memberships.has(id));
}

export function normalizeMaterialGroups(input:unknown) {
  const parsed=materialGroupsSchema.parse(input);
  const ids=parsed.group_ids ? [...new Set(parsed.group_ids)] : parsed.group_id ? [parsed.group_id] : null;
  return {group_id:ids?.[0] || null,group_ids:ids};
}
