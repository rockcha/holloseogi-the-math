const DAY = 86400000

export function todayDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null
}

export function billingError(form) {
  if (!Number.isInteger(Number(form.billing_cycle_sessions)) || Number(form.billing_cycle_sessions) < 1 || Number(form.billing_cycle_sessions) > 365) return '결제 주기는 1~365회 사이의 정수로 입력해 주세요.'
  if (form.billing_amount === '' || !Number.isSafeInteger(Number(form.billing_amount)) || Number(form.billing_amount) < 0 || Number(form.billing_amount) > 2147483647) return '결제 금액은 0~2,147,483,647원 사이의 정수로 입력해 주세요.'
  const start = parseDate(form.billing_start_date)
  if (!start) return '결제 시작일을 입력해 주세요.'
  if (!form.weekdays.includes(start.getUTCDay() || 7)) return '결제 시작일은 선택한 수업 요일이어야 해요.'
  return null
}

// The anchor lesson is session 1. Attendance does not change scheduled sessions.
export function cycleFor(lesson, number) {
  if (!lesson || billingError(lesson) || !Number.isInteger(number) || number < 1 || number > 10000) return null
  const anchor = parseDate(lesson.billing_start_date)
  const offsets = Array.from({ length: 7 }, (_, offset) => offset).filter((offset) => lesson.weekdays.includes(new Date(anchor.getTime() + offset * DAY).getUTCDay() || 7))
  const sessionDate = (index) => new Date(anchor.getTime() + (Math.floor(index / offsets.length) * 7 + offsets[index % offsets.length]) * DAY).toISOString().slice(0, 10)
  const first = (number - 1) * Number(lesson.billing_cycle_sessions)
  return { number, start: sessionDate(first), end: sessionDate(first + Number(lesson.billing_cycle_sessions) - 1), first: first + 1, last: first + Number(lesson.billing_cycle_sessions) }
}

export function currentCycle(lesson, date = todayDate()) {
  if (!lesson || billingError(lesson) || !parseDate(date) || date < lesson.billing_start_date) return 1
  const anchor = parseDate(lesson.billing_start_date)
  const days = Math.floor((parseDate(date) - anchor) / DAY)
  const remainder = Array.from({ length: days % 7 + 1 }, (_, offset) => new Date(anchor.getTime() + offset * DAY).getUTCDay() || 7).filter((day) => lesson.weekdays.includes(day)).length
  const count = Math.floor(days / 7) * new Set(lesson.weekdays).size + remainder
  return Math.min(10000, Math.floor((count - 1) / Number(lesson.billing_cycle_sessions)) + 1)
}

export function availableCycles(lesson, attendance = [], date = todayDate()) {
  if (!cycleFor(lesson, 1) || !parseDate(date) || lesson.billing_start_date > date) return []
  const numbers = new Set([currentCycle(lesson, date)])
  for (const sheet of attendance) {
    if (sheet.class_id === lesson.id && parseDate(sheet.attendance_date) && sheet.attendance_date >= lesson.billing_start_date && sheet.attendance_date <= date) {
      numbers.add(currentCycle(lesson, sheet.attendance_date))
    }
  }
  return [...numbers].sort((a, b) => a - b).map((number) => cycleFor(lesson, number))
}

export function paymentStatus(amount, paid) {
  return paid >= amount ? '완납' : paid > 0 ? '일부 납부' : '미납'
}

export function classPaymentSummary(lesson, payments, number) {
  const cycle = cycleFor(lesson, number)
  if (!cycle) return { cycle: null, rows: [], total: 0, complete: 0, unpaid: 0, label: '결제 설정 필요' }
  const receipts = payments.filter((item) => item.class_id === lesson.id && item.cycle_number === number)
  const roster = new Set([...(lesson.class_students || []).map((item) => item.student_id), ...receipts.map((item) => item.student_id)])
  const amounts = new Map()
  receipts.forEach((item) => amounts.set(item.student_id, (amounts.get(item.student_id) || 0) + item.amount))
  const rows = [...roster].map((id) => ({ id, paid: amounts.get(id) || 0, status: paymentStatus(lesson.billing_amount, amounts.get(id) || 0) }))
  const complete = rows.filter((row) => row.status === '완납').length
  const unpaid = rows.length - complete
  return { cycle, rows, total: rows.length, complete, unpaid, label: !rows.length ? '참여 학생 없음' : unpaid ? `미납 학생 ${unpaid}명` : '납부 완료' }
}

export const won = (amount) => `${Number(amount).toLocaleString('ko-KR')}원`
