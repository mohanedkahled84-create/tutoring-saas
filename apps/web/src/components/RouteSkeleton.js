export function renderRouteSkeleton(route = '', en = false) {
  const box = (width, height = 16) => `<span class="skeleton-box" style="width:${width};height:${height}px"></span>`;
  const bar = `<div class="route-skeleton-toolbar">${box('200px',26)}${box('110px',40)}</div>`;
  const tabs = `<div class="route-skeleton-tabs">${[1,2,3].map(()=>box('110px',38)).join('')}</div>`;
  const cards = (count=3, cls='route-skeleton-group') => `<div class="route-skeleton-groups">${Array.from({length:count},()=>`<div class="skeleton-card ${cls}">${box('60%',22)}${box('85%')}${box('70%')}${box('95%',38)}</div>`).join('')}</div>`;
  const rows = (count=5) => `<div class="route-skeleton-content">${Array.from({length:count},()=>`<div class="route-skeleton-row">${box('24%',18)}${box('20%')}${box('18%')}${box('70px',32)}</div>`).join('')}</div>`;
  const metrics = `<div class="route-skeleton-metrics">${[1,2,3,4].map(()=>`<div class="skeleton-card">${box('60%')}${box('40%',28)}</div>`).join('')}</div>`;
  const hero = `<div class="skeleton-card route-skeleton-hero">${box('45%',26)}${box('75%')}${box('130px',40)}</div>`;
  const form = `<div class="skeleton-card route-skeleton-form">${[1,2,3,4].map(()=>`${box('25%')}${box('100%',44)}`).join('')}</div>`;
  let content;
  if (['dashboard','center-dashboard','admin-dashboard','reports','risk-watchlist'].includes(route)) content = metrics + rows(3);
  else if (['groups','assistants','center-assistants','center-rooms','center-teachers','materials','video-lessons','online-quizzes','paper-exams','billing','student-cards','coupons'].includes(route)) content = tabs + cards();
  else if (['calendar','sessions','center-sessions'].includes(route)) content = tabs + cards(3,'route-skeleton-day') + rows(2);
  else if (['settings','whatsapp','platform-builder'].includes(route)) content = tabs + form;
  else if (['announcements','support','admin-support','announcement-admin'].includes(route)) content = hero + rows(3);
  else content = tabs + rows();
  return `<section class="route-skeleton" role="status" aria-busy="true" aria-label="${en?'Loading page':'جار تحميل الصفحة'}"><div aria-hidden="true">${bar}${content}</div></section>`;
}
