import assert from 'node:assert/strict'
import { calendarEntries, calendarEventError, dateKey, monthDays } from './calendar.js'

const february = monthDays(new Date(2024, 1, 1))
assert.equal(february[0].getDay(), 1)
assert.equal(february.at(-1).getDay(), 0)
assert.ok(february.some((date) => dateKey(date) === '2024-02-29'))
assert.equal(monthDays(new Date(2021, 1, 1)).length, 28)
assert.equal(monthDays(new Date(2026, 7, 1)).length, 42)
assert.equal(dateKey(monthDays(new Date(2027, 0, 1))[0]), '2026-12-28')
const valid = { title: '상담', event_date: '2026-09-09', allDay: true, start_time: '', end_time: '' }
assert.equal(calendarEventError(valid), null)
assert.equal(calendarEventError({ ...valid, memo: '메모\n둘째 줄' }), null)
assert.equal(calendarEventError({ ...valid, memo: '가'.repeat(5000) }), null)
assert.ok(calendarEventError({ ...valid, memo: '가'.repeat(5001) }))
assert.equal(calendarEventError({ ...valid, allDay: false, start_time: '09:30', end_time: '10:00' }), null)
for (const patch of [{ title: ' ' }, { event_date: '2026-02-30' }, { event_date: '' }, { allDay: false }, { allDay: false, start_time: '10:00', end_time: '10:00' }]) assert.ok(calendarEventError({ ...valid, ...patch }))
const classes = [{ id: 'c1', name: '수학', weekdays: [1, 3], start_time: '15:00:00', end_time: '16:00:00' }]
const events = [{ id: 'e1', title: '상담', event_date: '2026-09-09', start_time: null, end_time: null }]
assert.deepEqual(calendarEntries(new Date(2026, 8, 9), classes, events).map((item) => item.id), ['e1', 'c1'])
assert.deepEqual(calendarEntries(new Date(2026, 8, 16), classes, events).map((item) => item.id), ['c1'])
assert.equal(calendarEntries(new Date(2026, 8, 10), classes, events).length, 0)
console.log('Calendar month boundaries, leap years, dated events and recurring class checks passed.')
