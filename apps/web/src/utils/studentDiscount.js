// Store the final session fee in the existing pricing fields used by attendance and reports.
export function studentDiscount(basePrice, amount) {
  const base=Number(basePrice), discount=Number(String(amount ?? '').trim() || 0);
  if(!Number.isFinite(base) || base<0)throw Error('تعذر قراءة سعر المجموعة؛ اختر مجموعة بسعر صحيح');
  if(!Number.isFinite(discount) || discount<0 || discount>base || Math.abs(discount*100-Math.round(discount*100))>0.000001)throw Error('اكتب خصمًا صحيحًا بين صفر وسعر الحصة، بحد أقصى منزلتين عشريتين');
  const fee=Math.round((base-discount)*100)/100;
  return {fee,discount,fee_override:discount>0 && fee>0?fee:null,exempt:discount>0 && fee===0};
}
