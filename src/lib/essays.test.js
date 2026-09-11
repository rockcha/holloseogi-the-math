import assert from 'node:assert/strict'
import { essayError, essayDday, filterEssays, essayForm, essayPayload, essaySaveError } from './essays.js'

const form = { university_name: '테스트대학교', essay_type: '약술', track: '인문', schedule_name: '인문계열', exam_date: '2026-11-14', memo: '' }
assert.equal(essayError(form), null)
assert.ok(essayError({ ...form, university_name: '  ' }))
assert.ok(essayError({ ...form, essay_type: '약술', track: '사회' }))
assert.equal(essayError({ ...form, essay_type: '인문', track: '사회' }), null)
assert.equal(essayError({ ...form, track: '자연' }), null)
assert.ok(essayError({ ...form, essay_type: '기타' }))
assert.ok(essayError({ ...form, exam_date: '2026-02-29' }))
assert.equal(essayError({ ...form, exam_date: '2028-02-29' }), null)
assert.ok(essayError({ ...form, memo: '가'.repeat(5001) }))
assert.equal(essayDday('2027-01-01', '2026-12-31'), 'D-1')
assert.equal(essayDday('2026-11-14', '2026-11-14'), 'D-day')
assert.equal(essayDday('2026-11-13', '2026-11-14'), '종료 · 1일 전')
assert.equal(essayDday('2028-03-01', '2028-02-28'), 'D-2')
const entries = [form, { ...form, university_name: '다른대학교', essay_type: '인문', track: '사회', memo: '자료 해석' }]
assert.equal(filterEssays(entries, '약술', '').length, 1)
assert.equal(filterEssays(entries, '인문', '자료')[0].university_name, '다른대학교')
assert.equal(filterEssays(entries, '', ' 사회 ').length, 1)
assert.equal(filterEssays(entries, '약술', '자료').length, 0)
const trackEntries = [
  form,
  { ...form, track: '자연' },
  ...['인문', '사회', '자연'].map((track) => ({ ...form, essay_type: '인문', track })),
]
assert.equal(filterEssays(trackEntries, '약술', '', '인문').length, 1)
assert.equal(filterEssays(trackEntries, '약술', '', '자연').length, 1)
assert.equal(filterEssays(trackEntries, '약술', '', '사회').length, 0)
assert.equal(filterEssays(trackEntries, '인문', '', '사회').length, 1)
assert.equal(filterEssays(trackEntries, '', '', '자연').length, 2)
assert.equal(filterEssays(entries, '인문', '자료', '사회').length, 1)
assert.equal(filterEssays(entries, '인문', '자료', '자연').length, 0)
assert.equal(essayError({ ...form, schedule_name: '  ' }), null)
assert.equal(essayPayload({ ...essayForm(), ...form, schedule_name: '', track: '자연' }).p_schedule_name, '자연계열')
const legacy = essayForm({ ...form, schedule_name: '' })
assert.equal(legacy.schedule_name, '')
assert.equal(essayPayload(legacy).p_schedule_name, '인문계열')
assert.equal(legacy.exam_time, '')
assert.equal(legacy.minimum_requirement, '')
const exam = essayForm({ ...form, schedule_name: ' 인문·체육계열 ', exam_time: ' 오전 ', department_group: ' 체육대학 ', question_format: ' 비교·분석형 ', subjects: ' 제시문과 도표 ', minimum_requirement: ' 없음 ' })
const payload = essayPayload(exam, 'exam-one', ['student-one'])
assert.deepEqual(payload, {
  p_id: 'exam-one', p_student_ids: ['student-one'], p_university_name: '테스트대학교', p_essay_type: '약술',
  p_track: '인문', p_schedule_name: '인문·체육계열', p_exam_date: '2026-11-14', p_exam_time: '오전',
  p_department_group: '체육대학', p_question_format: '비교·분석형', p_subjects: '제시문과 도표', p_minimum_requirement: '없음', p_memo: '',
})
assert.equal(essayPayload(exam).p_id, null)
assert.deepEqual(essayPayload(exam).p_student_ids, [])
const sameUniversity = [
  { ...exam, id: 'exam-one' },
  { ...exam, id: 'exam-two', track: '자연', schedule_name: '자연계열', exam_time: '오후' },
]
assert.equal(filterEssays(sameUniversity, '', '테스트대학교').length, 2)
assert.equal(filterEssays(sameUniversity, '', '', '자연')[0].id, 'exam-two')
for (const term of ['체육', '비교·분석', '도표', '없음']) assert.equal(filterEssays([exam], '', term).length, 1)
assert.match(essaySaveError({ code: '23505' }), /이미 있어요/)
console.log('논술 유효성, 유형 필터, 검색, D-day 검증 통과')
