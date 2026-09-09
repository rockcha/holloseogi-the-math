export async function deleteStudentRecord(client, studentId) {
  if (!studentId) throw new Error('삭제할 학생을 찾을 수 없어요.')
  const { data, error } = await client.from('students').delete().eq('id', studentId).select('id').maybeSingle()
  if (error) throw error
  if (!data || data.id !== studentId) {
    const failure = new Error('학생이 삭제되지 않았어요. 삭제 권한을 확인하거나 목록을 새로고침해 주세요.')
    failure.code = 'STUDENT_NOT_DELETED'
    throw failure
  }
  return data.id
}

export function studentDeleteError(error) {
  if (error.code === '23503') return '결제 내역 등 연결된 기록이 있어 삭제할 수 없어요.'
  if (error.code === '42501') return '학생 삭제 권한이 없어요. 관리자에게 문의해 주세요.'
  return error.message || '학생을 삭제하지 못했어요.'
}
