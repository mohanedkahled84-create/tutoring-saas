// Every teacher navigation page is delegable. Account ownership/admin APIs are not.
export const assistantCatalog = [
 {key:'attendance',route:'sessions',label:'بدء حصة ورصد الحضور',actions:['view','create','edit']},
 {key:'homework',route:'homework',label:'مراجعة وتصحيح الواجبات',actions:['view','edit']},
 {key:'materials',route:'materials',label:'المذكرات والماتريال',actions:['view','create','edit','delete']},
 {key:'online-quizzes',route:'online-quizzes',label:'الكويزات الإلكترونية (أونلاين)',actions:['view','create','edit','delete','grade']},
 {key:'paper-exams',route:'paper-exams',label:'الامتحانات الورقية وبابل شيت',actions:['view','create','edit','delete','grade']},
 {key:'quizzes',route:'quizzes',label:'رصد درجات الكويزات يدوياً',actions:['view','create','edit','delete','grade']},
 {key:'platform-builder',route:'platform-builder',label:'إنشاء منصتك المستقلة',actions:['view','edit']},
 {key:'video-lessons',route:'video-lessons',label:'فيديوهات الشرح والحل',actions:['view','create','edit','delete']},
 {key:'students',route:'students',label:'دليل طلابي',actions:['view','create','edit','delete','send','collect']},
 {key:'groups',route:'groups',label:'مجاميعي الدراسية',actions:['view','create','edit','delete']},
 {key:'assistants',route:'assistants',label:'إدارة المساعدين (الأسستنت)',actions:['view','create','edit','delete']},
 {key:'sessions',route:'calendar',label:'جدول الحصص والتقويم',actions:['view','create','edit','delete']},
 {key:'student-cards',route:'student-cards',label:'طلب كروت الطلاب',actions:['view','create']},
 {key:'dashboard',route:'dashboard',label:'لوحة المعلم والأرباح',actions:['view']},
 {key:'reports',route:'reports',label:'الدرجات ولوحة الشرف',actions:['view','send']},
 {key:'risk-watchlist',route:'risk-watchlist',label:'مؤشرات الخطر والإنذارات',actions:['view','send']},
 {key:'settings',route:'settings',label:'الإعدادات والاشتراك',actions:['view','edit']},
] as const;
export const legacyAssistantActions=['grades.view','grades.edit','collections.view','collections.create','messages.view','messages.send'];
export function normalizeAssistantPermissions(input:Record<string,boolean>){
 const permissions={...input};
 const aliases:Record<string,string[]>= {'grades.view':['quizzes.view'],'grades.edit':['quizzes.grade'],'collections.view':['students.view'],'collections.create':['students.collect'],'messages.view':['reports.view'],'messages.send':['reports.send']};
 for(const [old,keys] of Object.entries(aliases))if(input[old])for(const key of keys)if(!(key in permissions))permissions[key]=true;
 return permissions;
}
export function hasAssistantCapability(permissions:Record<string,boolean>,resource:string,action='view'){
 if(resource==='grades')return (permissions['grades.view']===true && permissions[`grades.${action}`]===true) || (permissions['quizzes.view']===true && permissions[`quizzes.${action==='edit'?'grade':'view'}`]===true);
 if(resource==='collections')return (permissions['collections.view']===true && permissions[`collections.${action}`]===true) || (permissions['students.view']===true && permissions['students.collect']===true);
 if(resource==='messages')return (permissions['messages.view']===true && permissions[`messages.${action}`]===true) || (permissions['reports.view']===true && permissions[`reports.${action==='send'?'send':'view'}`]===true);
 return permissions[`${resource}.view`]===true && permissions[`${resource}.${action}`]===true;
}
