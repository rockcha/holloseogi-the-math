import { dateKey } from './calendar.js'

export const ESSAY_TRACKS = { '약술': ['인문', '자연'], '인문': ['인문', '사회', '자연'] }
export const ESSAY_DETAILS = [
  ['department_group', '모집단위', '예: 문과대학·체육대학'],
  ['question_format', '출제 형식', '예: 제시문 비교·분석형'],
  ['subjects', '출제 과목·구성', '예: 국어 8문항 + 수학 5문항'],
  ['minimum_requirement', '수능최저', '예: 없음 / 국수영탐 중 1개 영역 3등급 이내'],
]

export function essayForm(essay) {
  return {
    university_name: essay?.university_name || '', essay_type: essay?.essay_type || '약술',
    track: essay?.track || '인문', schedule_name: essay?.schedule_name || '',
    exam_date: essay?.exam_date || '', exam_time: essay?.exam_time || '', memo: essay?.memo || '',
    ...Object.fromEntries(ESSAY_DETAILS.map(([key]) => [key, essay?.[key] || ''])),
  }
}

export function essayPayload(form, id, students = []) {
  return {
    p_id: id || null, p_student_ids: students,
    ...Object.fromEntries(Object.entries(form).map(([key, value]) => [`p_${key}`, value.trim()])),
    p_schedule_name: form.schedule_name?.trim() || `${form.track}계열`,
  }
}

export function essaySaveError(error) {
  return error.code === '23505'
    ? '같은 대학·유형·계열·시험명·날짜·시간의 일정이 이미 있어요. 기존 일정을 확인해 주세요.'
    : error.message || '저장하지 못했어요. 입력 내용과 연결 상태를 확인해 주세요.'
}

export function essayError(form) {
  if (!form.university_name.trim() || form.university_name.trim().length > 100) return '대학교 이름을 1~100자로 입력해 주세요.'
  if (!ESSAY_TRACKS[form.essay_type]?.includes(form.track)) return '논술 유형에 맞는 계열을 선택해 주세요.'
  const date = new Date(`${form.exam_date}T12:00:00`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.exam_date) || Number.isNaN(date.getTime()) || dateKey(date) !== form.exam_date) return '올바른 시험 날짜를 선택해 주세요.'
  if (form.memo.length > 5000) return '특징 메모는 5,000자까지 입력할 수 있어요.'
  return null
}

export function essayDday(date, today = dateKey(new Date())) {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
  return days === 0 ? 'D-day' : days > 0 ? `D-${days}` : `종료 · ${-days}일 전`
}

export function filterEssays(essays, type, search, track = '') {
  const term = search.trim().toLocaleLowerCase()
  return essays.filter((item) => (!type || item.essay_type === type) && (!track || item.track === track) && (!term || [item.university_name, item.track, item.schedule_name, item.memo, ...ESSAY_DETAILS.map(([key]) => item[key])].some((text) => (text || '').toLocaleLowerCase().includes(term))))
}
