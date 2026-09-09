import assert from 'node:assert/strict'
import { layoutTimetableItems, scheduleError } from './schedule.js'

const valid = { title: '상담', weekdays: [1, 3], start_time: '07:15', end_time: '08:45', color_index: 2, memo: '' }
assert.equal(scheduleError(valid), null)
for (const change of [
  { title: ' ' }, { title: '가'.repeat(101) }, { weekdays: [] }, { weekdays: [8] },
  { start_time: '25:00' }, { end_time: '07:15' }, { end_time: '06:00' },
  { color_index: 10 }, { memo: '가'.repeat(5001) },
]) assert.ok(scheduleError({ ...valid, ...change }))

const item = (id, start_time, end_time) => ({ id, start_time, end_time })
assert.deepEqual(layoutTimetableItems([]), [])
const adjacent = layoutTimetableItems([item('b', '16:00', '17:00'), item('a', '15:00', '16:00')])
assert.ok(adjacent.every((entry) => entry.lane === 0 && entry.laneCount === 1))
const overlap = layoutTimetableItems([
  item('class', '15:00', '18:00'), item('meeting', '15:30', '16:00'),
  item('call', '16:00', '17:00'), item('later', '18:00', '19:00'),
])
assert.equal(overlap.find((entry) => entry.id === 'meeting').lane, overlap.find((entry) => entry.id === 'call').lane)
assert.equal(overlap.find((entry) => entry.id === 'later').laneCount, 1)
for (const first of overlap) for (const second of overlap) {
  if (first.id !== second.id && first.start_time < second.end_time && second.start_time < first.end_time) assert.notEqual(first.lane, second.lane)
}
const nested = layoutTimetableItems([item('a', '15:00', '18:00'), item('b', '15:00', '17:00'), item('c', '16:00', '16:30')])
assert.ok(nested.every((entry) => entry.laneCount === 3))
assert.equal(new Set(nested.map((entry) => entry.lane)).size, 3)
console.log('Schedule validation and overlapping timetable layout checks passed.')
