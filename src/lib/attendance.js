import { todayDate } from './payments.js'

export function latestClassDate(weekdays, today = todayDate()) {
  if (!weekdays?.length) return ''
  const date = new Date(today + 'T00:00:00Z')
  for (let offset = 0; offset < 7; offset += 1) {
    if (weekdays.includes(date.getUTCDay() || 7)) return date.toISOString().slice(0, 10)
    date.setUTCDate(date.getUTCDate() - 1)
  }
  return ''
}
