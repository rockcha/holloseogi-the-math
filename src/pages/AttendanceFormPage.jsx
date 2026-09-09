import { latestClassDate } from '../lib/attendance'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, Save } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'


import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const STATUS_OPTIONS = [
  { value: 'present', label: '출석', emoji: '✅', active: 'bg-[#dff1e4] text-[#1f5533]' },
  { value: 'absent', label: '결석', emoji: '❌', active: 'bg-[#f9dfdb] text-[#843b31]' },
]


export default function AttendanceFormPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const classId = searchParams.get('classId') || ''
  const date = searchParams.get('date') || ''
  const [statuses, setStatuses] = useState({})

  const classes = useQuery({
    queryKey: ['attendance-classes', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('id,name,start_time,end_time,weekdays,class_students(student_id,students(id,name,phone,parent_phone))').eq('teacher_id', user.id).order('start_time')
      if (error) throw error
      return data
    },
  })
  const existingSheet = useQuery({
    queryKey: ['attendance-sheet', user?.id, classId, date],
    enabled: Boolean(user && classId && date),
    queryFn: async () => {
      const { data, error } = await supabase.from('attendance_sheets').select('id,attendance_records(student_id,status,note)').eq('class_id', classId).eq('attendance_date', date).maybeSingle()
      if (error) throw error
      return data
    },
  })
  const selectedClass = useMemo(() => classes.data?.find((item) => item.id === classId), [classes.data, classId])
  const selectedWeekday = useMemo(() => {
    if (!date) return null
    const day = new Date(`${date}T00:00:00`).getDay()
    return day === 0 ? 7 : day
  }, [date])
  const classStudents = useMemo(() => (selectedClass?.class_students || []).map((item) => item.students).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'ko')), [selectedClass])


  useEffect(() => {
    if (!classId || !date || existingSheet.isLoading || existingSheet.isError) return
    const saved = Object.fromEntries((existingSheet.data?.attendance_records || []).map((record) => [record.student_id, record.status === 'present' ? 'present' : 'absent']))
    setStatuses(Object.fromEntries(classStudents.map((student) => [student.id, saved[student.id] || ''])))
  }, [classId, classStudents, date, existingSheet.data, existingSheet.isLoading, existingSheet.isError])

  const saveAttendance = useMutation({
    mutationFn: async () => {
      if (!classId || !selectedClass) throw new Error('수업을 선택해 주세요.')
      if (!date || !selectedClass.weekdays.includes(selectedWeekday)) throw new Error('선택한 수업 요일에 맞는 날짜를 선택해 주세요.')
      if (existingSheet.isLoading || existingSheet.isError) throw new Error('기존 출석부를 확인한 후 다시 시도해 주세요.')
      if (classStudents.some((student) => !['present', 'absent'].includes(statuses[student.id]))) throw new Error('모든 학생의 출석 또는 결석을 체크해 주세요.')
      if (!classStudents.length) throw new Error('이 수업에 참여 중인 학생이 없어요.')
      const { data: sheet, error: sheetError } = await supabase.from('attendance_sheets').upsert({ class_id: classId, attendance_date: date, updated_at: new Date().toISOString() }, { onConflict: 'class_id,attendance_date' }).select('id').single()
      if (sheetError) throw sheetError
      const records = classStudents.map((student) => ({ sheet_id: sheet.id, student_id: student.id, status: statuses[student.id] }))
      const { error: recordsError } = await supabase.from('attendance_records').upsert(records, { onConflict: 'sheet_id,student_id' })
      if (recordsError) throw recordsError
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attendance-sheets'] })
      await queryClient.invalidateQueries({ queryKey: ['attendance-sheet'] })
      toast.success(existingSheet.data ? '출석부를 수정했어요.' : '출석부를 저장했어요.')
      navigate('/attendance')
    },
    onError: (error) => toast.error(error.message || '출석부를 저장하지 못했어요.'),
  })

  function updateLocation(nextClassId, nextDate) {
    const params = {}
    if (nextClassId) params.classId = nextClassId
    if (nextDate) params.date = nextDate
    setSearchParams(params, { replace: true })
  }
  function changeClass(nextClassId) {


    setStatuses({})
    updateLocation(nextClassId, latestClassDate(classes.data?.find((item) => item.id === nextClassId)?.weekdays))
  }
  function changeDate(nextDate) {

    setStatuses({})
    updateLocation(classId, nextDate)
  }
  const validDate = Boolean(date && selectedClass?.weekdays.includes(selectedWeekday))
  const allChecked = classStudents.length > 0 && classStudents.every((student) => ['present', 'absent'].includes(statuses[student.id]))
  const allPresent = classStudents.length > 0 && classStudents.every((student) => statuses[student.id] === 'present')

  function markAllPresent() {
    setStatuses(Object.fromEntries(classStudents.map((student) => [student.id, 'present'])))
  }

  if (authLoading) return <div className="grid min-h-screen place-items-center bg-[#f7f9f5] text-[#65736b]">불러오는 중...</div>
  if (!user) return <main className="grid min-h-screen place-items-center"><Link to="/login">로그인이 필요해요</Link></main>

  return <div className="flex min-h-screen flex-col bg-[#f7f9f5] text-[#26372f]">
    
    <main className="mx-auto w-[min(1080px,calc(100%-32px))] py-10 [&>section]:max-w-none">
      <div className="mb-8"><h1 className="font-display flex items-center gap-3 text-4xl font-bold"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e8edf7] text-[#4f638d]"><ClipboardCheck className="h-6 w-6" /></span>{existingSheet.data ? '출석부 수정' : '출석부 작성'}</h1><p className="mt-3 text-sm text-[#758078]">수업과 날짜를 선택하고 학생들의 출석 상태를 체크하세요.</p></div>
      <section className="rounded-3xl border border-[#e1e7df] bg-white p-6 shadow-sm sm:p-7">
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="attendance-class">수업 선택</Label><select className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm" disabled={classes.isLoading || classes.isError || saveAttendance.isPending} id="attendance-class" onChange={(event) => changeClass(event.target.value)} value={classId}><option value="">{classes.isLoading ? '수업을 불러오는 중...' : '수업을 선택하세요'}</option>{(classes.data || []).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.start_time.slice(0, 5)}</option>)}</select></div><div className="space-y-2"><Label htmlFor="attendance-date">수업 날짜</Label><Input className="h-11" disabled={!classId || saveAttendance.isPending} id="attendance-date" onChange={(event) => changeDate(event.target.value)} type="date" value={date} /></div></div>
        {classes.isError && <p role="alert" className="mt-4 text-sm text-[#a95848]">수업을 불러오지 못했어요. <Button variant="outline" onClick={() => classes.refetch()}>다시 불러오기</Button></p>}
        {!classes.isLoading && !classes.isError && !classes.data?.length && <p className="mt-4 text-sm text-[#758078]">등록된 수업이 없어요. <Link className="underline" to="/classes?action=new">수업 추가하기</Link></p>}
        {classId && date && !validDate && <p role="alert" className="mt-4 text-sm text-[#a95848]">선택한 수업 요일에 맞는 날짜를 골라 주세요.</p>}
      </section>
      {validDate && !classes.isLoading && !classes.isError && !existingSheet.isLoading && !existingSheet.isError && classStudents.length > 0 && <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#758078]">전체 출석을 선택한 뒤 결석 학생만 변경하세요.</p>
        <Button type="button" variant="outline" className="h-11 border-[#b9d5c2] text-[#305c45]" disabled={saveAttendance.isPending || allPresent} onClick={markAllPresent}><ClipboardCheck size={18} />전체 출석</Button>
      </div>}
      {!classId ? <section className="mx-auto mt-6 max-w-2xl rounded-3xl border border-dashed border-[#ccd8cf] bg-white/60 p-16 text-center"><p className="font-semibold">출석을 체크할 수업을 선택해 주세요.</p></section> : !validDate ? <section className="mt-6 rounded-xl border border-dashed border-[#ccd8cf] p-12 text-center text-sm text-[#758078]">수업 날짜를 선택해 주세요.</section> : existingSheet.isError ? <section role="alert" className="mt-6 rounded-xl bg-white p-10 text-center"><p>기존 출석부를 불러오지 못했어요.</p><Button className="mt-4" variant="outline" onClick={() => existingSheet.refetch()}>다시 불러오기</Button></section> : existingSheet.isLoading || classes.isLoading ? <section className="mx-auto mt-6 max-w-2xl rounded-3xl border border-[#e1e7df] bg-white p-16 text-center text-sm text-[#879189]">학생 명단을 불러오는 중...</section> : !classStudents.length ? <section className="mx-auto mt-6 max-w-2xl rounded-3xl border border-[#e1e7df] bg-white p-14 text-center"><p className="font-semibold">이 수업에 참여 중인 학생이 없어요.</p><Button asChild className="mt-4" variant="outline"><Link to={`/classes/${classId}`}>학생 추가하러 가기</Link></Button></section> : <section className="mx-auto mt-6 max-w-2xl overflow-hidden rounded-3xl border border-[#e1e7df] bg-white shadow-sm"><div className="divide-y divide-[#edf0eb]">{classStudents.map((student) => <article className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center" key={student.id}><div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-5 gap-y-1"><strong className="truncate text-base">{student.name}</strong><span className="truncate text-sm text-[#879189]">{student.phone || student.parent_phone || '연락처 없음'}</span></div><div className="grid grid-cols-2 overflow-hidden bg-[#f1f3f1]">{STATUS_OPTIONS.map(({ value, label, emoji, active }) => { const isSelected = statuses[student.id] === value; return <button disabled={saveAttendance.isPending} aria-label={student.name + ' ' + label} aria-pressed={isSelected} className={`flex h-12 min-w-24 items-center justify-center gap-2 px-4 text-sm font-bold transition ${isSelected ? active : 'bg-[#f1f3f1] text-[#b8beba] opacity-45 hover:opacity-65'}`} key={value} onClick={() => setStatuses((current) => ({ ...current, [student.id]: value }))} type="button"><span aria-hidden="true" className={`text-lg ${isSelected ? '' : 'grayscale opacity-40'}`}>{emoji}</span>{label}</button> })}</div></article>)}</div><div className="border-t border-[#edf0eb] bg-[#fafbf9] p-5"><Button className="h-11 w-full bg-[#305c45] font-bold text-white hover:bg-[#264c38]" disabled={saveAttendance.isPending || !allChecked || !validDate} onClick={() => saveAttendance.mutate()}><Save />{!allChecked ? '모든 학생의 출석·결석을 체크해 주세요.' : saveAttendance.isPending ? '저장 중...' : existingSheet.data ? '출석부 수정하기' : '출석부 저장하기'}</Button></div></section>}
    </main>
    
  </div>
}
