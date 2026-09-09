export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function monthDays(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  const count = Math.ceil((offset + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7
  return Array.from({ length: count }, (_, index) => new Date(first.getFullYear(), first.getMonth(), 1 - offset + index))
}

export function calendarEntries(date, classes, events) {
  const key = dateKey(date)
  const weekday = date.getDay() || 7
  return [
    ...classes.filter((item) => item.weekdays.includes(weekday)).map((item) => ({ ...item, kind: 'class', title: item.name })),
    ...events.filter((item) => item.event_date === key).map((item) => ({ ...item, kind: 'event' })),
  ].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '') || a.title.localeCompare(b.title, 'ko'))
}

export function calendarEventError(form) {
  if ((form.memo || '').length > 5000) return '메모는 5,000자까지 입력할 수 있어요.'
  if (!form.title.trim() || form.title.trim().length > 100) return '제목을 1~100자로 입력해 주세요.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.event_date)) return '날짜를 선택해 주세요.'
  const date = new Date(`${form.event_date}T12:00:00`)
  if (Number.isNaN(date.getTime()) || dateKey(date) !== form.event_date) return '올바른 날짜를 선택해 주세요.'
  if (!form.allDay) {
    if (![form.start_time, form.end_time].every((time) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))) return '시작 시간과 종료 시간을 입력해 주세요.'
    if (form.end_time <= form.start_time) return '종료 시간은 시작 시간보다 늦어야 해요.'
  }
  return null
}
