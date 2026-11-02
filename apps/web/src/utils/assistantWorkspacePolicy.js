// UI capabilities mirror the server's existing per-resource permissions.
// They never replace the assistant API's tenant/group/action checks.
export const routeResources = {
 sessions:['attendance'], calendar:['sessions'], students:['students'], groups:['groups'],
 homework:['homework'], materials:['materials'], quizzes:['grades','quizzes'],
 reports:['reports','messages'], collections:['collections'], messages:['messages'],
 'online-quizzes':['online-quizzes'], 'paper-exams':['paper-exams'], 'platform-builder':['platform-builder'],
 'video-lessons':['video-lessons'], assistants:['assistants'], 'student-cards':['student-cards'],
 dashboard:['dashboard'], 'risk-watchlist':['risk-watchlist'], settings:['settings'],
};
export function assistantCan(permissions,resource,action='view') {
 return permissions?.[`${resource}.view`]===true && permissions?.[`${resource}.${action}`]===true;
}
export function assistantCanNavigate(permissions,route) {
 return (routeResources[route] || []).some(resource=>assistantCan(permissions,resource));
}
export function assistantResourceRoute(resource) {
 return resource==='attendance'?'sessions':resource==='sessions'?'calendar':resource==='grades'?'quizzes':resource;
}
