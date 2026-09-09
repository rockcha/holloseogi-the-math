import { availableCycles, billingError, classPaymentSummary, currentCycle, cycleFor, paymentStatus } from './payments.js'

function equal(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`)
}
const lesson = { billing_start_date: '2026-09-07', weekdays: [1, 3], billing_cycle_sessions: 8, billing_amount: 200000 }
equal(cycleFor(lesson, 1), { number: 1, start: '2026-09-07', end: '2026-09-30', first: 1, last: 8 }, '8회 첫 주기')
equal(cycleFor(lesson, 2), { number: 2, start: '2026-10-05', end: '2026-10-28', first: 9, last: 16 }, '9회부터 다음 주기')
equal(currentCycle(lesson, '2026-09-06'), 1, '시작 전')
equal(currentCycle(lesson, '2026-09-30'), 1, '마지막 수업일')
equal(currentCycle(lesson, '2026-10-04'), 1, '다음 수업 전 공백')
equal(currentCycle(lesson, '2026-10-05'), 2, '다음 주기 경계')
equal(cycleFor({ ...lesson, billing_start_date: '2024-02-28' }, 1).end, '2024-03-25', '윤년과 월 경계')
equal(cycleFor({ ...lesson, weekdays: [1, 1, 3] }, 2), cycleFor(lesson, 2), '요일 중복')
equal(cycleFor({ ...lesson, weekdays: [1], billing_cycle_sessions: 1 }, 2).start, '2026-09-14', '주 1회 / 주기 1회')
equal(cycleFor(lesson, 0), null, '0주기 거부')
equal(cycleFor(lesson, 1.5), null, '소수 주기 거부')
equal(cycleFor({ ...lesson, billing_start_date: null }, 1), null, '미설정 수업')
equal(Boolean(billingError({ ...lesson, billing_start_date: '2026-09-08' })), true, '수업 요일 아닌 시작일')
equal(Boolean(billingError({ ...lesson, billing_amount: '' })), true, '빈 금액 거부')
equal(Boolean(billingError({ ...lesson, billing_start_date: '2026-02-30' })), true, '존재하지 않는 날짜')
equal(paymentStatus(200000, 0), '미납', '미납')
equal(paymentStatus(200000, 50000 + 100000), '일부 납부', '분할 납부 합산')
equal(paymentStatus(200000, 50000 + 150000), '완납', '분할 완납')
equal(paymentStatus(200000, 250000), '완납', '초과 납부')
equal(paymentStatus(0, 0), '완납', '무료 수업')
const group = { ...lesson, id: 'class-a', class_students: [{ student_id: 'a' }, { student_id: 'b' }] }
equal(availableCycles(group, [], '2026-11-02').map((item) => item.number), [3], '기록이 없으면 이번 단위만 선택 가능')
const sheets = [
  { class_id: 'class-a', attendance_date: '2026-09-07' },
  { class_id: 'class-a', attendance_date: '2026-09-09' },
  { class_id: 'class-b', attendance_date: '2026-10-05' },
  { class_id: 'class-a', attendance_date: '2026-12-07' },
  { class_id: 'class-a', attendance_date: '2026-09-06' },
]
equal(availableCycles(group, sheets, '2026-11-02').map((item) => item.number), [1, 3], '이전 수업 기록 포함, 중복·다른 수업·미래 기록 제외')
equal(availableCycles(group, sheets, '2026-09-06'), [], '수업 시작 전 미래 단위 제외')
equal(availableCycles(undefined), [], '수업 미선택')
const receipt = (student_id, amount, cycle_number = 1, class_id = 'class-a') => ({ student_id, amount, cycle_number, class_id })
equal(classPaymentSummary(group, [], 1).label, '미납 학생 2명', '기록 없는 수업 자동 미납')
equal(classPaymentSummary(group, [receipt('a', 300000)], 1).label, '미납 학생 1명', '한 학생의 초과 납부로 다른 학생을 완납 처리하지 않음')
equal(classPaymentSummary(group, [receipt('a', 200000), receipt('b', 100000)], 1).unpaid, 1, '일부 납부 학생 포함')
const fullyPaid = [receipt('a', 200000), receipt('b', 100000), receipt('b', 100000)]
equal(classPaymentSummary(group, fullyPaid, 1).label, '납부 완료', '전원 납부 시 자동 완료')
equal(classPaymentSummary(group, fullyPaid, 1).complete, 2, '분할 결제 합산')
equal(classPaymentSummary(group, fullyPaid, 2).label, '미납 학생 2명', '지난 주기 납부가 이번 주기에 영향 없음')
equal(classPaymentSummary(group, [receipt('a', 200000, 1, 'class-b')], 1).complete, 0, '다른 수업 결제 제외')
equal(classPaymentSummary(group, [receipt('a', 200000, null, null)], 1).complete, 0, '일반 결제 제외')
equal(classPaymentSummary({ ...group, class_students: [] }, [], 1).label, '참여 학생 없음', '학생 없는 수업은 완료 표시 안 함')
equal(classPaymentSummary({ ...group, billing_start_date: null }, [], 1).label, '결제 설정 필요', '설정 누락 구분')
equal(classPaymentSummary(undefined, [], 1).label, '결제 설정 필요', '없는 수업 안전 처리')
equal(classPaymentSummary(group, fullyPaid, 0).cycle, null, '잘못된 URL 주기 번호')
equal(classPaymentSummary(group, [receipt('a', 200000, null)], 1).complete, 0, '시작일 설정 후에도 주기 미지정 결제를 임의 배정하지 않음')
// Compare the optimized arithmetic against a day-by-day calendar across all weekday combinations.
for (let mask = 1; mask < 128; mask += 1) {
  const weekdays = Array.from({ length: 7 }, (_, index) => index + 1).filter((day) => mask & (1 << (day - 1)))
  const start = new Date('2026-09-07T00:00:00Z')
  while (!weekdays.includes(start.getUTCDay() || 7)) start.setUTCDate(start.getUTCDate() + 1)
  for (const size of [1, 3, 8, 12, 365]) {
    const candidate = { ...lesson, weekdays, billing_start_date: start.toISOString().slice(0, 10), billing_cycle_sessions: size }
    const date = new Date(start)
    const dates = []
    while (dates.length < size * 3) {
      if (weekdays.includes(date.getUTCDay() || 7)) dates.push(date.toISOString().slice(0, 10))
      date.setUTCDate(date.getUTCDate() + 1)
    }
    for (let number = 1; number <= 3; number += 1) {
      const cycle = cycleFor(candidate, number)
      equal(cycle.start, dates[(number - 1) * size], '달력 순회 시작일 비교')
      equal(cycle.end, dates[number * size - 1], '달력 순회 종료일 비교')
      equal(currentCycle(candidate, cycle.start), number, '달력 순회 주기 비교')
    }
  }
}
console.log('결제 검증 33건 및 127개 요일 조합 × 5개 주기 길이의 달력 비교 통과')
