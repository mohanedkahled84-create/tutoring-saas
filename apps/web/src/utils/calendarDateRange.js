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
