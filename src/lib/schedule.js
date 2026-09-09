export const SCHEDULE_COLORS = ['#83cf9c', '#8bb8e8', '#c4a0e6', '#e99aa7', '#e8cc70', '#79c9bc', '#d8b08c', '#a0a9e3', '#b3d579', '#e8ac7d']
export const SCHEDULE_DAYS = ['월', '화', '수', '목', '금', '토', '일']

export function scheduleError(values) {
  if (!values.title.trim() || values.title.trim().length > 100) return '제목을 1~100자로 입력해 주세요.'
  if (!values.weekdays.length || values.weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) return '일정 요일을 선택해 주세요.'
  if (![values.start_time, values.end_time].every((time) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))) return '시작 시간과 종료 시간을 입력해 주세요.'
  if (values.end_time <= values.start_time) return '종료 시간은 시작 시간보다 늦어야 해요.'
  if (!Number.isInteger(values.color_index) || values.color_index < 0 || values.color_index >= SCHEDULE_COLORS.length) return '일정 색상을 선택해 주세요.'
  if (values.memo.length > 5000) return '메모는 5,000자까지 입력할 수 있어요.'
  return null
}

// 겹치는 수업과 일정은 같은 시간대에서 나란히 표시합니다.
export function layoutTimetableItems(items) {
  const sorted = [...items].sort((a, b) => a.start_time.localeCompare(b.start_time) || a.end_time.localeCompare(b.end_time) || a.id.localeCompare(b.id))
  const result = []
  let group = []
  let groupEnd = ''
  function flush() {
    const laneEnds = []
    const placed = group.map((item) => {
      let lane = laneEnds.findIndex((end) => end <= item.start_time)
      if (lane === -1) lane = laneEnds.length
      laneEnds[lane] = item.end_time
      return { ...item, lane }
    })
    result.push(...placed.map((item) => ({ ...item, laneCount: laneEnds.length })))
  }
  for (const item of sorted) {
    if (group.length && item.start_time >= groupEnd) {
      flush()
      group = []
      groupEnd = ''
    }
    group.push(item)
    if (item.end_time > groupEnd) groupEnd = item.end_time
  }
  if (group.length) flush()
  return result
}
