import ClassTimeSelect from '../components/ClassTimeSelect'
import ClassMemo from '../components/ClassMemo'
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, Check, Trash2, UserPlus, Users, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'


import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

import BillingFields from '../components/BillingFields'
import { billingError } from '../lib/payments'

const DAYS = [
  { value: 1, label: '월' }, { value: 2, label: '화' }, { value: 3, label: '수' },
  { value: 4, label: '목' }, { value: 5, label: '금' }, { value: 6, label: '토' }, { value: 7, label: '일' },
]
const COLOR_SWATCHES = [
  'bg-[#72ad83]', 'bg-[#70a1ce]', 'bg-[#9b78bd]', 'bg-[#d47b89]', 'bg-[#d8a94f]',
  'bg-[#61aaa5]', 'bg-[#ad8168]', 'bg-[#7888c5]', 'bg-[#98a44d]', 'bg-[#d58659]',
]
const EARLIEST_START_TIME = '08:00'

export default function ClassDetailPage() {
  const { classId } = useParams()
  const { user, isLoading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [studentSearch, setStudentSearch] = useState('')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [pendingStudentIds, setPendingStudentIds] = useState([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const classQuery = useQuery({
    queryKey: ['class', classId],
    enabled: Boolean(user && classId),
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('id,name,start_time,end_time,weekdays,color_index,billing_cycle_sessions,billing_amount,billing_start_date,class_students(student_id)').eq('id', classId).single()
      if (error) throw error
      return data
    },
  })
  const students = useQuery({
    queryKey: ['students'],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.from('students').select('id,name,phone,parent_phone').order('name')
      if (error) throw error
      return data
    },
  })

  useEffect(() => {
    if (!classQuery.data) return
    setForm({
      name: classQuery.data.name,
      start_time: classQuery.data.start_time.slice(0, 5),
      end_time: classQuery.data.end_time.slice(0, 5),
      weekdays: [...classQuery.data.weekdays],
      color_index: classQuery.data.color_index ?? 0,
      billing_cycle_sessions: classQuery.data.billing_cycle_sessions,
      billing_amount: classQuery.data.billing_amount,
      billing_start_date: classQuery.data.billing_start_date,
    })
    setSelectedStudentIds((classQuery.data.class_students || []).map((item) => item.student_id))
  }, [classQuery.data])

  const saveDetails = useMutation({
    mutationFn: async (nextForm) => {
      const { error } = await supabase.from('classes').update({ ...nextForm, name: nextForm.name.trim() }).eq('id', classId)
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['classes', user.id] })
    },
    onError: (error) => toast.error(error.message?.includes('class_time_conflict') ? '같은 시간에 다른 수업이 있어요.' : error.message),
  })
  const deleteClass = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('classes').delete().eq('id', classId)
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['classes', user.id] })
      toast.success('수업을 삭제했어요.')
      navigate('/classes', { replace: true })
    },
    onError: (error) => toast.error(error.code === '23503' ? '결제 내역이 있는 수업은 기록 보존을 위해 삭제할 수 없어요.' : error.message || '수업을 삭제하지 못했어요.'),
  })
  const addStudents = useMutation({
    mutationFn: async () => {
      if (!pendingStudentIds.length) return
      const { error } = await supabase.from('class_students').insert(pendingStudentIds.map((studentId) => ({ class_id: classId, student_id: studentId })))
      if (error) throw error
    },
    onSuccess: async () => {
      await classQuery.refetch()
      setAddDialogOpen(false)
      setPendingStudentIds([])
      setStudentSearch('')
      toast.success('학생을 수업에 추가했어요.')
    },
    onError: (error) => toast.error(error.message || '학생을 추가하지 못했어요.'),
  })
  const removeStudent = useMutation({
    mutationFn: async (studentId) => {
      const { error } = await supabase.from('class_students').delete().eq('class_id', classId).eq('student_id', studentId)
      if (error) throw error
    },
    onSuccess: async () => {
      await classQuery.refetch()
      toast.success('학생을 수업에서 제외했어요.')
    },
    onError: (error) => toast.error(error.message || '학생을 제외하지 못했어요.'),
  })

  function toggleDay(day) {
    setForm((current) => ({ ...current, weekdays: current.weekdays.includes(day) ? current.weekdays.filter((value) => value !== day) : [...current.weekdays, day].sort() }))
  }

  useEffect(() => {
    if (!form || !classQuery.data) return
    const original = {
      name: classQuery.data.name,
      start_time: classQuery.data.start_time.slice(0, 5),
      end_time: classQuery.data.end_time.slice(0, 5),
      weekdays: classQuery.data.weekdays,
      color_index: classQuery.data.color_index ?? 0,
      billing_cycle_sessions: classQuery.data.billing_cycle_sessions,
      billing_amount: classQuery.data.billing_amount,
      billing_start_date: classQuery.data.billing_start_date,
    }
    const normalizedForm = { ...form, name: form.name.trim(), billing_cycle_sessions: Number(form.billing_cycle_sessions), billing_amount: Number(form.billing_amount), billing_start_date: form.billing_start_date || null }
    if (JSON.stringify(normalizedForm) === JSON.stringify(original)) return
    if (![normalizedForm.start_time, normalizedForm.end_time].every((time) => /^(?:[01][0-9]|2[0-3]):(?:00|30)$/.test(time))) return
    if (!normalizedForm.name || !normalizedForm.weekdays.length || normalizedForm.start_time < EARLIEST_START_TIME || normalizedForm.end_time <= normalizedForm.start_time) return
    if (form.billing_amount === '' || form.billing_cycle_sessions === '' || (normalizedForm.billing_start_date && billingError(normalizedForm))) return
    const timer = window.setTimeout(() => saveDetails.mutate(normalizedForm), 700)
    return () => window.clearTimeout(timer)
  // saveDetails.mutate is stable; depending on the mutation result object would restart the debounce every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classQuery.data, form])
  const normalizedSearch = studentSearch.trim().toLocaleLowerCase('ko-KR').replaceAll('-', '')
  const participatingStudents = (students.data || []).filter((student) => selectedStudentIds.includes(student.id))
  const availableStudents = (students.data || []).filter((student) => !selectedStudentIds.includes(student.id))
  const filteredStudents = availableStudents.filter((student) => {
    if (!normalizedSearch) return true
    return [student.name, student.phone, student.parent_phone].some((value) => value?.toLocaleLowerCase('ko-KR').replaceAll('-', '').includes(normalizedSearch))
  })

  function openAddStudents() {
    setPendingStudentIds([])
    setStudentSearch('')
    setAddDialogOpen(true)
  }

  if (authLoading) return <div className="grid min-h-screen place-items-center bg-[#f7f9f5] text-[#65736b]">불러오는 중...</div>
  if (!user) return <main className="grid min-h-screen place-items-center"><Link to="/login">로그인이 필요해요</Link></main>
  if (classQuery.isError) return <div className="min-h-screen bg-[#f7f9f5]"><main className="mx-auto max-w-xl px-5 py-20 text-center"><h1 className="text-2xl font-bold">수업을 찾을 수 없어요.</h1><Button className="mt-5" onClick={() => navigate('/classes')} variant="outline">시간표로 돌아가기</Button></main></div>
  if (classQuery.isLoading || !form) return <div className="min-h-screen bg-[#f7f9f5]"><p className="p-16 text-center text-sm text-[#879189]">수업을 불러오는 중...</p></div>

  return <div className="flex min-h-screen flex-col bg-[#f7f9f5] text-[#26372f]">
    
    <main className="mx-auto w-[min(1080px,calc(100%-32px))] py-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-5"><h1 className="dashboard-page-title inline-page-title">수업 상세보기</h1><div className="flex flex-wrap gap-2"><Button className="h-11 bg-[#b84e43] px-5 text-white hover:bg-[#9f4138]" onClick={() => setDeleteDialogOpen(true)}><Trash2 />수업 삭제</Button><Button asChild className="h-11 bg-[#305c45] px-5 text-white hover:bg-[#264c38]"><Link to={`/payments/classes/${classId}`}>결제 관리</Link></Button><Button asChild className="h-11 bg-[#305c45] px-5 text-white hover:bg-[#264c38]"><Link to={`/attendance/new?classId=${classId}`}><CalendarCheck />출석 체크</Link></Button><Button className="h-11 bg-[#305c45] px-5 text-white hover:bg-[#264c38]" onClick={openAddStudents}><UserPlus />학생 추가</Button></div></div>
      <section className="grid overflow-hidden rounded-xl border border-[#e1e7df] bg-white lg:grid-cols-[1.2fr_1fr]">
        <div className="min-w-0 p-6 sm:p-7">
          <div className="flex items-center justify-between gap-3"><h2 className="detail-section-title">수업 정보</h2><span className="text-xs font-medium text-[#879189]">{saveDetails.isPending ? '저장 중...' : '자동 저장'}</span></div>
          <form className="mt-6 space-y-5" onSubmit={(event) => event.preventDefault()}>
            <div className="space-y-2"><Label htmlFor="detail-name">수업 이름</Label><Input id="detail-name" required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="detail-start">시작 시간</Label><ClassTimeSelect id="detail-start" value={form.start_time} onChange={(value) => setForm((current) => ({ ...current, start_time: value }))} /><p className="text-xs text-[#879189]">오전 8시부터 선택할 수 있어요.</p></div><div className="space-y-2"><Label htmlFor="detail-end">종료 시간</Label><ClassTimeSelect id="detail-end" value={form.end_time} after={form.start_time} onChange={(value) => setForm((current) => ({ ...current, end_time: value }))} /></div></div>
            <fieldset><legend className="mb-2 text-sm font-medium">요일</legend><div className="grid grid-cols-7 gap-1.5">{DAYS.map((day) => <Button className={`h-10 px-0 ${form.weekdays.includes(day.value) ? 'bg-[#305c45] text-white hover:bg-[#264c38]' : ''}`} key={day.value} onClick={() => toggleDay(day.value)} type="button" variant={form.weekdays.includes(day.value) ? 'default' : 'outline'}>{day.label}</Button>)}</div></fieldset>
            <fieldset><legend className="mb-2 text-sm font-medium">수업 색상</legend><div className="flex flex-wrap gap-2">{COLOR_SWATCHES.map((color, index) => <button aria-label={`${index + 1}번 색상`} className={`grid h-9 w-9 place-items-center rounded-full text-white ${color} ${form.color_index === index ? 'ring-2 ring-[#305c45] ring-offset-2' : ''}`} key={color} onClick={() => setForm((current) => ({ ...current, color_index: index }))} type="button">{form.color_index === index && <Check className="h-4 w-4" />}</button>)}</div></fieldset>
            <BillingFields form={form} setForm={setForm} optional />
            {form.billing_start_date && billingError(form) && <p className="text-sm text-[#a95848]">{billingError(form)}</p>}
            {saveDetails.isError && <p role="alert" className="text-sm text-[#a95848]">저장하지 못했어요: {saveDetails.error.message}</p>}
          </form>
        </div>
        <div className="min-w-0 overflow-hidden border-t border-[#edf0eb] lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-4 border-b border-[#edf0eb] p-6 sm:p-7"><h2 className="detail-section-title">참여 학생</h2><span className="text-xs font-semibold text-[#527b65]">{selectedStudentIds.length}명</span></div>
          {students.isLoading ? <p className="p-10 text-center text-sm text-[#879189]">학생을 불러오는 중...</p> : students.isError ? <p className="p-10 text-center text-sm text-[#a95848]">학생 목록을 불러오지 못했어요.</p> : !participatingStudents.length ? <div className="p-14 text-center"><Users className="mx-auto h-9 w-9 text-[#b8c3bb]" /><p className="mt-3 font-semibold">참여 중인 학생이 없어요.</p><p className="mt-1 text-sm text-[#879189]">학생 추가 버튼으로 명단을 구성해 주세요.</p></div> : <div className="max-h-[560px] divide-y divide-[#edf0eb] overflow-y-auto">{participatingStudents.map((student) => <div className="flex items-center gap-3 px-6 py-4" key={student.id}><span className="grid h-9 w-9 place-items-center rounded-full bg-[#e7f0e9] font-bold text-[#426751]">{student.name.slice(0, 1)}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{student.name}</strong><span className="block truncate text-xs text-[#879189]">{student.phone || student.parent_phone || '연락처 없음'}</span></span><Button aria-label={`${student.name} 수업에서 제외`} disabled={removeStudent.isPending} onClick={() => removeStudent.mutate(student.id)} size="icon" title="수업에서 제외" variant="ghost"><X className="h-4 w-4 text-[#a95848]" /></Button></div>)}</div>}
        </div>
      </section>
      <ClassMemo key={classId} classId={classId} />
      <Dialog open={addDialogOpen} onOpenChange={(open) => { if (!addStudents.isPending) setAddDialogOpen(open) }}>
        <DialogContent className="max-h-[calc(100vh-32px)] overflow-hidden rounded-3xl p-0 sm:max-w-lg">
          <DialogHeader className="px-6 pt-6"><DialogTitle className="font-display text-2xl font-bold">학생 추가</DialogTitle><DialogDescription>아직 참여하지 않은 학생을 검색하고 선택하세요.</DialogDescription></DialogHeader>
          <div className="px-6"><div className="relative"><Input autoFocus aria-label="추가할 학생 검색" className="pl-9" onChange={(event) => setStudentSearch(event.target.value)} placeholder="이름 또는 연락처로 검색" type="search" value={studentSearch} /></div></div>
          <div className="h-[360px] overflow-y-auto border-y border-[#edf0eb]">
            {students.isLoading ? <div className="grid h-full place-items-center"><p className="text-sm text-[#879189]">학생을 불러오는 중...</p></div> : !availableStudents.length ? <div className="grid h-full place-items-center p-10 text-center"><div><p className="text-sm font-semibold">추가할 학생이 없어요.</p><p className="mt-1 text-xs text-[#879189]">모든 학생이 이미 참여 중이거나 등록된 학생이 없습니다.</p><Link className="mt-4 inline-block text-sm font-bold text-[#305c45]" to="/students">학생 등록하러 가기</Link></div></div> : !filteredStudents.length ? <div className="grid h-full place-items-center p-10 text-center"><div><p className="text-sm font-semibold">검색 결과가 없어요.</p><p className="mt-1 text-xs text-[#879189]">다른 이름이나 연락처로 검색해 보세요.</p></div></div> : <div className="divide-y divide-[#edf0eb]">{filteredStudents.map((student) => <label className="flex min-h-[72px] cursor-pointer items-center gap-3 px-6 py-4 hover:bg-[#f7f9f5]" key={student.id}><input checked={pendingStudentIds.includes(student.id)} className="h-4 w-4 accent-[#305c45]" onChange={() => setPendingStudentIds((current) => current.includes(student.id) ? current.filter((id) => id !== student.id) : [...current, student.id])} type="checkbox" /><span className="grid h-9 w-9 place-items-center rounded-full bg-[#e7f0e9] font-bold text-[#426751]">{student.name.slice(0, 1)}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{student.name}</strong><span className="block truncate text-xs text-[#879189]">{student.phone || student.parent_phone || '연락처 없음'}</span></span></label>)}</div>}
          </div>
          <DialogFooter className="m-0 border-0 bg-transparent px-6 pb-6"><span className="mr-auto self-center text-sm font-semibold text-[#527b65]">선택 {pendingStudentIds.length}명</span><Button className="h-11 px-5" onClick={() => setAddDialogOpen(false)} type="button" variant="outline">취소</Button><Button className="h-11 bg-[#305c45] px-5 text-white hover:bg-[#264c38]" disabled={!pendingStudentIds.length || addStudents.isPending} onClick={() => addStudents.mutate()} type="button">{addStudents.isPending ? '추가 중...' : '선택 학생 추가'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!deleteClass.isPending) setDeleteDialogOpen(open) }}>
        <DialogContent className="rounded-2xl p-6" showCloseButton={false}>
          <DialogHeader><DialogTitle className="font-display text-xl font-bold">삭제하시겠습니까?</DialogTitle><DialogDescription><strong className="text-[#39473f]">{classQuery.data.name}</strong> 수업의 참여 학생 배정과 작성된 출석부가 함께 삭제되며 되돌릴 수 없습니다.</DialogDescription></DialogHeader>
          <DialogFooter className="mx-0 mb-0 mt-3 rounded-none border-0 bg-transparent p-0"><Button className="h-11 px-5" disabled={deleteClass.isPending} onClick={() => setDeleteDialogOpen(false)} variant="outline">취소</Button><Button className="h-11 bg-[#a95848] px-5 text-white hover:bg-[#914438]" disabled={deleteClass.isPending} onClick={() => deleteClass.mutate()}>{deleteClass.isPending ? '삭제 중...' : '수업 삭제'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
    
  </div>
}
