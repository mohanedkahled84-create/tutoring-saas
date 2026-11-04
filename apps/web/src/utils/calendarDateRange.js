export function calendarDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function calendarWeekRange(offset = 0, anchor = new Date()) {
  const saturday = new Date(anchor);
  saturday.setDate(anchor.getDate() - ((anchor.getDay() + 1) % 7) + (Number(offset) || 0) * 7);
  const friday = new Date(saturday);
  friday.setDate(saturday.getDate() + 6);
  return { from: calendarDateKey(saturday), to: calendarDateKey(friday) };
}

export function calendarToday(now=new Date()) {
  const key=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  return new Date(key+'T12:00:00');
}
export function calendarMonthRange(offset=0,anchor=calendarToday()) {
  return {from:calendarDateKey(new Date(anchor.getFullYear(),anchor.getMonth()+Number(offset || 0),1,12)),to:calendarDateKey(new Date(anchor.getFullYear(),anchor.getMonth()+Number(offset || 0)+1,0,12))};
}
export function calendarSessionOnDate(session,key,sessions=[]) {
  if(!session.is_recurring)return (session.date || session.session_date)===key;
  const day=new Date(key+'T12:00:00').getDay(),names=['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  return session.day_name===names[day] && !sessions.some(saved=>!saved.is_recurring && !saved.is_extra && saved.group_id===session.group_id && (saved.original_session_date || saved.session_date || saved.date)===key);
}
