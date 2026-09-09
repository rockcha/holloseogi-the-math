import assert from 'node:assert/strict'
import { deleteStudentRecord, studentDeleteError } from './students.js'

function fakeClient(result) {
  return { from(table) {
    assert.equal(table, 'students')
    return { delete() { return { eq(column, id) {
      assert.equal(column, 'id')
      assert.equal(id, 'student-1')
      return { select(columns) {
        assert.equal(columns, 'id')
        return { maybeSingle: async () => result }
      } }
    } } } }
  } }
}
assert.equal(await deleteStudentRecord(fakeClient({ data: { id: 'student-1' }, error: null }), 'student-1'), 'student-1')
await assert.rejects(deleteStudentRecord(fakeClient({ data: null, error: null }), 'student-1'), { code: 'STUDENT_NOT_DELETED' })
await assert.rejects(deleteStudentRecord(fakeClient({ data: null, error: { code: '23503' } }), 'student-1'), { code: '23503' })
await assert.rejects(deleteStudentRecord(fakeClient({ data: null, error: { code: '42501' } }), 'student-1'), { code: '42501' })
await assert.rejects(deleteStudentRecord({}, null), /삭제할 학생/)
assert.match(studentDeleteError({ code: '23503' }), /연결된 기록/)
console.log('Student deletion checks passed, including zero-row RLS responses.')
