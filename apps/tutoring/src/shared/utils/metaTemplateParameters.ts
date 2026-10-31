// These existing templates already print "مستر" before the third body variable.
export function metaTemplateParameters(name:string,parameters:string[]):string[] {
 const values=[...parameters];
 if(['centerly','centerly_student'].includes(name) && values.length>=3){
  values[2]=String(values[2] || '').trim().replace(/^(?:مستر(?:\s*[/：:،-]\s*|\s+|$))+/u,'').trim() || 'المعلم';
 }
 return values;
}
