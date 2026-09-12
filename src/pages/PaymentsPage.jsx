import TeacherScope from '../components/TeacherScope'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, CircleAlert, Plus } from 'lucide-react'
import { toast } from 'sonner'


import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { availableCycles, classPaymentSummary, currentCycle, cycleFor, todayDate, won } from '../lib/payments'

const selectStyle = 'h-11 w-full rounded-xl border border-[#dce4dc] bg-white px-3 text-sm'
const emptyForm = () => ({ student_id: '', class_id: '', cycle_number: 1, amount: '', paid_on: todayDate() })

// Supabase caps each response; load every page so totals and history stay complete.
async function readAll(table, columns, order) {
  const rows = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from(table).select(columns).order(order).order('id').range(from, from + 499)
    if (error) throw error
    rows.push(...data)
    if (data.length < 500) return rows
  }
}

export default function PaymentsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [params, setParams] = useSearchParams()
  const { classId } = useParams()
  const location = useLocation()
  const tab = location.pathname.startsWith('/payments/classes') ? 'cycles' : 'history'
  const queryClient = useQueryClient()
  const [showAll, setShowAll] = useState(false)
  const [classSearch, setClassSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [historyClass, setHistoryClass] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState(null)
  const [deletingPayment, setDeletingPayment] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [studentSearch, setStudentSearch] = useState('')
  const profile = useQuery({ queryKey: ['teacher-profile', user?.id], enabled: Boolean(user), queryFn: async () => {
    const { data, error } = await supabase.from('users').select('is_teacher').eq('id', user.id).single()
    if (error) throw error
    return data
  } })
  const enabled = Boolean(user && profile.data?.is_teacher)
  const dataQuery = useQuery({ queryKey: ['payment-data', user?.id], enabled, refetchOnMount: 'always', queryFn: async () => {
    const [classes, students, payments, attendance] = await Promise.all([
      readAll('classes', 'id,teacher_id,name,weekdays,billing_cycle_sessions,billing_amount,billing_start_date,class_students(student_id)', 'name'),
      readAll('students', 'id,name,phone', 'name'),
      readAll('payments', '*', 'paid_on'),
      readAll('attendance_sheets', 'id,class_id,attendance_date', 'attendance_date'),
    ])
    return { classes, students, payments, attendance }
  } })
  const { classes = [], students = [], payments = [], attendance = [] } = dataQuery.data || {}
  const visibleClasses = classes.filter((item) => showAll || item.teacher_id === user?.id)
  const matchingClasses = visibleClasses.filter((item) => item.name.toLocaleLowerCase().includes(classSearch.trim().toLocaleLowerCase()))
  const lesson = classes.find((item) => item.id === classId)
  const lessonCycles = availableCycles(lesson, attendance)
  const requestedNumber = Number(params.get('cycle'))
  const number = lessonCycles.some((period) => period.number === requestedNumber) ? requestedNumber : currentCycle(lesson)
  const setCycleNumber = (value) => setParams(value === null ? {} : { cycle: String(value) })
  const cycle = cycleFor(lesson, Number(number))
  const formLesson = classes.find((item) => item.id === form.class_id)
  const formCycles = availableCycles(formLesson, attendance)
  const originalClass = editingPayment?.class_id === form.class_id
  const originalStudent = originalClass && editingPayment?.student_id === form.student_id
  const originalAssignment = originalStudent && editingPayment.cycle_number === form.cycle_number
  if (originalClass && !formCycles.some((period) => period.number === editingPayment.cycle_number)) {
    formCycles.push({ number: editingPayment.cycle_number, start: editingPayment.cycle_start, end: editingPayment.cycle_end })
    formCycles.sort((a, b) => (a.number || 0) - (b.number || 0))
  }
  const studentMap = new Map(students.map((student) => [student.id, student]))
  const selectedStudent = studentMap.get(form.student_id)
  const enrolledClasses = classes.filter((item) => item.teacher_id === user?.id && (item.class_students.some((member) => member.student_id === form.student_id) || (originalStudent && item.id === editingPayment.class_id)))
  const searchTerm = studentSearch.trim().toLocaleLowerCase('ko-KR').replaceAll('-', '')
  const matchingStudents = searchTerm ? students.filter((student) => [student.name, student.phone].some((value) => value?.toLocaleLowerCase('ko-KR').replaceAll('-', '').includes(searchTerm))) : []
  const summary = classPaymentSummary(lesson, payments, Number(number))
  const rows = summary.rows.map((row) => ({ ...row, name: studentMap.get(row.id)?.name || '학생 정보 없음' })).sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  const history = payments.filter((payment) => payment.class_id && (showAll || classes.some((item) => item.id === payment.class_id && item.teacher_id === user?.id)) && (historyClass === 'all' || payment.class_id === historyClass) && (studentMap.get(payment.student_id)?.name || '').includes(search.trim())).sort((a, b) => b.paid_on.localeCompare(a.paid_on) || b.created_at.localeCompare(a.created_at))
  const savePayment = useMutation({ mutationFn: async (values) => {
    const payload = {
      student_id: values.student_id, amount: Number(values.amount), paid_on: values.paid_on,
      class_id: values.class_id, cycle_number: values.cycle_number === null ? null : classes.find((item) => item.id === values.class_id)?.billing_start_date ? Number(values.cycle_number) : null,
    }
    const request = editingPayment
      ? supabase.from('payments').update(payload).eq('id', editingPayment.id).eq('teacher_id', user.id).select('id').single()
      : supabase.from('payments').insert(payload)
    const { error } = await request
    if (error) throw error
  }, onSuccess: async () => {
    closeDialog()
    setForm(emptyForm())
    await queryClient.invalidateQueries({ queryKey: ['payment-data', user.id] })
    toast.success(editingPayment ? '결제 내역을 수정했어요.' : '결제 내역을 추가했어요.')
  }, onError: (error) => toast.error(error.message || '결제를 저장하지 못했어요.') })

  const deletePayment = useMutation({ mutationFn: async (payment) => {
    if (!enabled || payment.teacher_id !== user.id) throw new Error('본인이 등록한 결제만 삭제할 수 있어요.')
    const { error } = await supabase.from('payments').delete().eq('id', payment.id).eq('teacher_id', user.id).select('id').single()
    if (error) throw error
    return payment.id
  }, onSuccess: async (id) => {
    queryClient.setQueryData(['payment-data', user.id], (previous) => previous ? {
      ...previous, payments: previous.payments.filter((payment) => payment.id !== id),
    } : previous)
    await queryClient.invalidateQueries({ queryKey: ['payment-data', user.id] })
    setDeletingPayment(null)
    toast.success('결제 내역을 삭제했어요.')
  }, onError: (error) => toast.error(error.message || '결제 내역을 삭제하지 못했어요.') })

  function openDelete(payment) {
    if (!enabled || payment.teacher_id !== user.id || deletePayment.isPending) return
    deletePayment.reset()
    setDeletingPayment(payment)
  }
  function closeDialog() {
    setDialogOpen(false)
    setEditingPayment(null)
    setForm(emptyForm())
    if (params.get('action') === 'new') {
      const next = new URLSearchParams(params)
      next.delete('action')
      setParams(next, { replace: true })
    }
  }
  function openEdit(payment) {
    if (payment.teacher_id !== user.id) return
    savePayment.reset()
    setEditingPayment(payment)
    setStudentSearch('')
    setForm({ student_id: payment.student_id, class_id: payment.class_id, cycle_number: payment.cycle_number, amount: String(payment.amount), paid_on: payment.paid_on })
    setDialogOpen(true)
  }
  function openAdd(studentId = '') {
    setEditingPayment(null)
    savePayment.reset()
    setStudentSearch('')
    setForm({ ...emptyForm(), ...(studentId && tab === 'cycles' && cycle ? { class_id: lesson.id, cycle_number: currentCycle(lesson), amount: String(lesson.billing_amount) } : {}), student_id: studentId })
    setDialogOpen(true)
  }
  function selectStudent(studentId) {
    setForm((value) => ({ ...value, student_id: studentId, class_id: '', cycle_number: 1, amount: '' }))
    setStudentSearch('')
    savePayment.reset()
  }
  function submit(event) {
    event.preventDefault()
    if (savePayment.isPending) return
    if (!form.student_id || !students.some((item) => item.id === form.student_id)) return toast.error('학생을 선택해 주세요.')
    if (!formLesson || formLesson.teacher_id !== user.id) return toast.error('수강 중인 수업을 선택해 주세요.')
    if (!Number.isInteger(Number(form.amount)) || Number(form.amount) <= 0 || Number(form.amount) > 2147483647) return toast.error('결제 금액은 1~2,147,483,647원 사이의 정수로 입력해 주세요.')
    if (!form.paid_on || form.paid_on > todayDate()) return toast.error('결제일은 오늘 또는 이전 날짜를 선택해 주세요.')
    if (!originalAssignment && (!formLesson?.class_students.some((item) => item.student_id === form.student_id) || (formLesson.billing_start_date && (form.cycle_number === null || !formCycles.some((period) => period.number === Number(form.cycle_number)))))) return toast.error('선택한 수업의 참여 학생과 결제 주기를 확인해 주세요.')
    savePayment.mutate(form)
  }

  if (!classId && params.get('classId')) return <Navigate replace to={`/payments/classes/${encodeURIComponent(params.get('classId'))}`} />
  if (authLoading) return <p className="p-16 text-center">불러오는 중...</p>
  if (!user) return <main className="grid min-h-screen place-items-center"><Link to="/login">로그인이 필요해요</Link></main>
  return <div className="flex min-h-screen flex-col bg-[#f7f9f5] text-[#26372f]">
    
    <main className="mx-auto w-[min(1080px,calc(100%-32px))] flex-1 py-10">
      {tab === 'history' && <div className="mb-4 flex flex-wrap items-center justify-between gap-4"><h1 className="dashboard-page-title inline-page-title">결제 리스트</h1><div className="ml-auto"><TeacherScope all={showAll} onChange={(all) => { setShowAll(all); setHistoryClass('all') }} /></div><Button className="h-11 bg-[#305c45] text-white hover:bg-[#264c38]" disabled={!enabled || !dataQuery.data || dataQuery.isError} onClick={() => openAdd()}><Plus />결제 내역 추가하기</Button></div>}
      {profile.isLoading || (enabled && dataQuery.isLoading) ? <p className="p-12 text-center">결제 정보를 불러오는 중...</p> : profile.isError || dataQuery.isError ? <div role="alert" className="rounded-2xl bg-[#fff2ee] p-6"><p>결제 정보를 불러오지 못했어요.</p><p className="mt-2 text-sm">{profile.error?.message || dataQuery.error?.message}</p><Button className="mt-4" variant="outline" onClick={() => { profile.refetch(); dataQuery.refetch() }}>다시 시도</Button></div> : !enabled ? <p>교사로 승인된 계정만 결제를 관리할 수 있어요.</p> : <>
        {tab === 'cycles' && !classId ? <section aria-label="수업별 납부 현황"><div className="mb-4 flex justify-end"><TeacherScope all={showAll} onChange={setShowAll} /></div><div className="mb-5 max-w-md space-y-2"><Input aria-label="수업 검색" id="payment-class-search" className="h-11 bg-white" type="search" placeholder="수업 이름 검색" value={classSearch} onChange={(event) => setClassSearch(event.target.value)} /></div>{classes.length > 0 && !matchingClasses.length && <p className="rounded-xl bg-white p-12 text-center text-sm text-[#879189]">검색 결과가 없어요.</p>}
          
          <div className="grid gap-4 sm:grid-cols-2">{matchingClasses.map((item) => {
            const itemSummary = classPaymentSummary(item, payments, currentCycle(item))
            const complete = itemSummary.total > 0 && itemSummary.unpaid === 0
            return <article className="flex min-w-0 flex-col rounded-lg border border-[#e1e7df] bg-white p-5 sm:p-6" key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="min-w-0 break-words text-lg font-semibold">{item.name}</h3><span className={`inline-flex items-center gap-1.5 text-xs font-medium ${complete ? 'text-[#315f48]' : itemSummary.unpaid ? 'text-[#9a4936]' : 'text-[#758078]'}`}>{complete ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}{itemSummary.label}</span></div>
              {itemSummary.cycle ? <div className="my-5 space-y-4"><div><p className="text-xs text-[#879189]">{itemSummary.cycle.start > todayDate() ? '예정 단위기간' : '현재 단위기간'}</p><p className="mt-1 text-sm text-[#58665e]">{itemSummary.cycle.start} ~ {itemSummary.cycle.end}</p></div><div className="flex items-end justify-between gap-3 text-sm"><span className="text-[#758078]">납부 완료 <strong className="ml-2 font-semibold text-[#305c45]">{itemSummary.complete} / {itemSummary.total}명</strong></span></div><div aria-label={`${itemSummary.total}명 중 ${itemSummary.complete}명 납부 완료`} className="h-1 overflow-hidden bg-[#edf0eb]"><div className="h-full bg-[#527b65]" style={{ width: `${itemSummary.total ? itemSummary.complete / itemSummary.total * 100 : 0}%` }} /></div></div> : <p className="my-5 text-sm text-[#758078]">결제 시작일과 금액을 설정해 주세요.</p>}
              <div className="mt-auto flex justify-end border-t border-[#edf0eb] pt-4"><Button asChild variant="outline" size="sm" className="text-[#305c45]"><Link aria-label={`${item.name} 납부 현황 상세보기`} to={`/payments/classes/${item.id}`}>상세보기 <ArrowRight className="h-4 w-4" /></Link></Button></div>
            </article>
          })}</div>
          {!classes.length && <p className="rounded-2xl bg-white p-12 text-center">등록된 수업이 없어요. <Link className="underline" to="/classes">수업 추가하기</Link></p>}
        </section> : tab === 'cycles' ? <section className="rounded-lg border border-[#e1e7df] bg-white p-5 sm:p-7">
          <h1 className="dashboard-page-title inline-page-title mb-6">{lesson?.name || '수업을 찾을 수 없어요'}</h1>
          {lesson && <div className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]"><div className="space-y-2"><Label htmlFor="cycle-number">단위기간 선택</Label><Select value={lessonCycles.length ? String(number) : ''} disabled={!lessonCycles.length} onValueChange={setCycleNumber}><SelectTrigger id="cycle-number" className="w-full data-[size=default]:h-11"><SelectValue placeholder="선택 가능한 단위기간이 없어요" /></SelectTrigger><SelectContent position="popper">{lessonCycles.map((period) => <SelectItem key={period.number ?? 'none'} value={String(period.number ?? 'none')}>{period.number === null ? '단위기간 미지정 (기존 내역)' : `${period.start} ~ ${period.end}`}{period.number === currentCycle(lesson) ? ' (현재)' : ''}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="payment-status">학생 보기</Label><select className={selectStyle} id="payment-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">모든 학생</option>{['완납', '일부 납부', '미납'].map((value) => <option key={value}>{value}</option>)}</select></div></div>}
          {!lesson ? <p className="py-12 text-center">삭제되었거나 접근할 수 없는 수업이에요.</p> : !lesson.billing_start_date ? <p className="py-12 text-center">결제 시작일을 먼저 설정해 주세요. <Link className="underline" to={`/classes/${lesson.id}`}>수업 설정</Link></p> : !cycle ? <p className="py-8 text-center">유효한 주기 번호(1~10,000)를 입력하고 수업 결제 설정을 확인해 주세요.</p> : <>
            <div className="my-6 border-y border-[#e1e7df] py-5">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[#758078]">단위 수강료 <span className="ml-2 font-medium text-[#26372f]">{won(lesson.billing_amount)}</span></p><span role="status" className={`inline-flex items-center gap-1.5 text-xs font-medium ${summary.unpaid ? 'text-[#9a4936]' : 'text-[#527b65]'}`}>{summary.total && !summary.unpaid ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}{summary.label}</span></div>
              <div className="grid grid-cols-3 divide-x divide-[#e1e7df]"><div className="pr-3"><p className="text-xs text-[#879189]">전체 학생</p><p className="mt-2 text-2xl font-semibold tabular-nums">{summary.total}<span className="ml-1 text-xs font-normal text-[#879189]">명</span></p></div><div className="px-3 sm:px-6"><p className="text-xs text-[#879189]">납부 완료</p><p className="mt-2 text-2xl font-semibold tabular-nums text-[#315f48]">{summary.complete}<span className="ml-1 text-xs font-normal">명</span></p></div><div className="pl-3 sm:pl-6"><p className="text-xs text-[#879189]">미납 · 일부 납부</p><p className="mt-2 text-2xl font-semibold tabular-nums text-[#9a4936]">{summary.unpaid}<span className="ml-1 text-xs font-normal">명</span></p></div></div>
            </div>
            <div className="overflow-x-auto border-t border-[#e1e7df]"><table className="w-full min-w-[560px] text-left text-sm"><thead className="border-b border-[#e1e7df] bg-[#fafbf9] text-xs text-[#758078]"><tr>{['학생', '결제 금액', '남은 금액', '상태', ''].map((title) => <th className="px-4 py-4" key={title}>{title}</th>)}</tr></thead><tbody>{rows.filter((row) => status === 'all' || row.status === status).map((row) => <tr className="border-b border-[#edf0eb] last:border-0 hover:bg-[#fafbf9]" key={row.id}><td className="px-4 py-4 font-medium">{row.name}</td><td className="px-4 py-4">{won(row.paid)}</td><td className="px-4 py-4">{won(Math.max(0, lesson.billing_amount - row.paid))}</td><td className="px-4 py-4"><span className={`inline-flex rounded-sm px-2 py-1 text-xs font-medium ${row.status === '완납' ? 'bg-[#e5f0e8] text-[#315f48]' : 'bg-[#fff2ee] text-[#9a4936]'}`}>{row.status}</span></td><td className="px-4 py-4"><Button variant="outline" size="sm" disabled={lesson.teacher_id !== user.id || !lesson.class_students.some((item) => item.student_id === row.id)} onClick={() => openAdd(row.id)}>결제 추가</Button></td></tr>)}</tbody></table></div>
            {!rows.filter((row) => status === 'all' || row.status === status).length && <p className="py-10 text-center text-sm text-[#758078]">표시할 학생이 없어요.</p>}
          </>}
        </section> : <section className="rounded-3xl border border-[#e1e7df] bg-white p-5 sm:p-7">
          
          <div className="mb-5 grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="history-search">학생 이름 검색</Label><Input id="history-search" className="h-11" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="학생 이름" /></div><div className="space-y-2"><Label htmlFor="history-class">수업 필터</Label><select id="history-class" className={selectStyle} value={historyClass} onChange={(event) => setHistoryClass(event.target.value)}><option value="all">모든 수업</option>{visibleClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div>
          <p className="mb-4 text-sm font-bold">조회 {history.length}건</p>
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="border-b text-[#758078]"><tr>{['결제일', '학생', '수업 / 주기', '결제 금액', '관리'].map((title) => <th className="p-3" key={title}>{title}</th>)}</tr></thead><tbody>{history.map((payment) => <tr className="border-b border-[#edf0eb]" key={payment.id}><td className="p-3">{payment.paid_on}</td><td className="p-3 font-bold">{studentMap.get(payment.student_id)?.name || '학생 정보 없음'}</td><td className="p-3">{payment.class_id ? <>{classes.find((item) => item.id === payment.class_id)?.name || '수업 정보 없음'}{payment.cycle_number !== null && <span className="mt-1 block text-xs text-[#758078]">{payment.cycle_start} ~ {payment.cycle_end}</span>}</> : '일반 결제'}</td><td className="p-3">{won(payment.amount)}</td><td className="p-3">{payment.teacher_id === user.id && <div className="flex items-center gap-2"><Button variant="outline" size="sm" aria-label={`${studentMap.get(payment.student_id)?.name || '학생'} ${payment.paid_on} 결제 내역 수정`} onClick={() => openEdit(payment)}>수정</Button><Button variant="destructive" size="sm" disabled={deletePayment.isPending} aria-label={`${studentMap.get(payment.student_id)?.name || '학생'} ${payment.paid_on} 결제 내역 삭제`} onClick={() => openDelete(payment)}>삭제</Button></div>}</td></tr>)}</tbody></table></div>
          {!history.length && <p className="py-12 text-center text-sm text-[#758078]">결제 내역이 없어요.</p>}
        </section>}
      </>}
      <Dialog open={dialogOpen || params.get('action') === 'new'} onOpenChange={(open) => { if (!savePayment.isPending && !open) closeDialog() }}><DialogContent className="max-h-[calc(100dvh-32px)] overflow-y-auto rounded-xl p-6 sm:max-w-3xl sm:p-8"><DialogHeader><DialogTitle className="font-display text-2xl font-semibold">{editingPayment ? '결제 내역 수정' : '결제 내역 추가'}</DialogTitle><DialogDescription>{editingPayment ? '수정할 내용을 입력하고 저장하세요. 변경 사항은 납부 현황에 반영돼요.' : '학생을 검색한 뒤 수강 중인 수업을 선택하세요. 수업의 결제 금액이 자동으로 입력돼요.'}</DialogDescription></DialogHeader>
        <form className="mt-2 space-y-6" onSubmit={submit}>
          <fieldset className="grid gap-x-6 gap-y-5 sm:grid-cols-2" disabled={savePayment.isPending || !enabled || !dataQuery.data}>
            <div className="space-y-2 border-b border-[#e1e7df] pb-5 sm:col-span-2">
              {selectedStudent ? <><Label>선택한 학생</Label><div className="flex items-center justify-between gap-3 border border-[#dce4dc] bg-[#f7f9f5] p-4"><div><strong>{selectedStudent.name}</strong></div><Button type="button" size="sm" variant="outline" onClick={() => selectStudent('')}>학생 변경</Button></div></> : <>
                <Label htmlFor="add-student-search">학생 검색 *</Label>
                <div className="relative"><Input autoFocus id="add-student-search" className="h-11 pl-9" type="search" placeholder="학생 이름 또는 연락처" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }} /></div>
                <div className="max-h-40 overflow-y-auto border border-[#e1e7df]" aria-label="학생 검색 결과">{matchingStudents.map((student) => <button className="flex w-full items-center justify-between gap-3 border-b border-[#edf0eb] px-4 py-3 text-left text-sm hover:bg-[#f0f5ef] focus-visible:bg-[#f0f5ef]" type="button" key={student.id} onClick={() => selectStudent(student.id)}><span><strong className="block">{student.name}</strong><span className="text-xs text-[#758078]">{student.phone || '연락처 없음'}</span></span><span className="text-xs font-bold text-[#305c45]">선택</span></button>)}{!matchingStudents.length && <p className="p-4 text-sm text-[#758078]" role="status">{searchTerm ? '검색 결과가 없어요.' : '이름이나 연락처를 입력해 학생을 찾아 주세요.'}</p>}</div>
              </>}
            </div>
            <div className="space-y-2"><Label htmlFor="add-class">수강 중인 수업 *</Label><Select required value={form.class_id} disabled={!selectedStudent || savePayment.isPending} onValueChange={(classId) => { const item = enrolledClasses.find((item) => item.id === classId); setForm((previous) => ({ ...previous, class_id: classId, cycle_number: currentCycle(item), amount: item ? String(item.billing_amount) : '' })) }}><SelectTrigger id="add-class" className="w-full data-[size=default]:h-11"><SelectValue placeholder={selectedStudent ? '수업 선택' : '학생을 먼저 선택해 주세요'} /></SelectTrigger><SelectContent position="popper">{enrolledClasses.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>{selectedStudent && !enrolledClasses.length && <p className="text-xs text-[#758078]">수강 중인 수업이 없어요. 수업에 학생을 먼저 추가해 주세요.</p>}</div>
            <div className="space-y-2"><Label htmlFor="add-cycle">단위기간 선택{formLesson?.billing_start_date ? ' *' : ''}</Label><Select value={formCycles.length ? String(form.cycle_number ?? 'none') : ''} disabled={savePayment.isPending || !formCycles.length} onValueChange={(value) => setForm((previous) => ({ ...previous, cycle_number: value === 'none' ? null : Number(value) }))}><SelectTrigger id="add-cycle" className="w-full data-[size=default]:h-11"><SelectValue placeholder={!formLesson ? '수업을 먼저 선택해 주세요' : !formLesson.billing_start_date ? '단위기간 미지정' : '선택 가능한 단위기간이 없어요'} /></SelectTrigger><SelectContent position="popper">{formCycles.map((period) => <SelectItem key={period.number ?? 'none'} value={String(period.number ?? 'none')}>{period.number === null ? '단위기간 미지정 (기존 내역)' : `${period.start} ~ ${period.end}`}{period.number === currentCycle(formLesson) ? ' · 현재 단위' : ''}</SelectItem>)}</SelectContent></Select>{formLesson && !formLesson.billing_start_date && <p className="text-xs text-[#758078]">단위기간 없이 저장되며, 단위별 납부 현황에는 포함되지 않아요.</p>}</div>
            <div className="space-y-2"><Label htmlFor="add-amount">결제 금액 (원) *</Label><Input id="add-amount" className="h-11" type="number" min="1" max="2147483647" step="1" required value={form.amount} onChange={(event) => setForm((value) => ({ ...value, amount: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="add-date">결제일 *</Label><Input id="add-date" className="h-11" type="date" required max={todayDate()} value={form.paid_on} onChange={(event) => setForm((value) => ({ ...value, paid_on: event.target.value }))} /></div>
          </fieldset>
          {savePayment.isError && <p role="alert" className="text-sm text-[#a95848]">{savePayment.error.message}</p>}
          <DialogFooter className="mx-0 mb-0 mt-6 rounded-none border-t bg-transparent px-0 pb-0 pt-5"><Button type="button" variant="outline" disabled={savePayment.isPending} onClick={() => closeDialog()}>취소</Button><Button type="submit" className="bg-[#305c45] text-white" disabled={savePayment.isPending || !enabled || !dataQuery.data || !selectedStudent || !form.class_id || (formLesson?.billing_start_date && !formCycles.length)}>{savePayment.isPending ? '저장 중...' : '결제 내역 저장'}</Button></DialogFooter>
        </form>
      </DialogContent></Dialog>
      <Dialog open={Boolean(deletingPayment)} onOpenChange={(open) => { if (!open && !deletePayment.isPending) setDeletingPayment(null) }}>
        <DialogContent showCloseButton={!deletePayment.isPending}>
          <DialogHeader>
            <DialogTitle>결제 내역 삭제</DialogTitle>
            <DialogDescription>이 결제 내역을 삭제할까요? 삭제하면 되돌릴 수 없으며, 납부 현황에서도 해당 금액이 제외돼요.</DialogDescription>
          </DialogHeader>
          {deletingPayment && <div className="space-y-1 rounded-lg bg-[#f7f9f5] p-4 text-sm">
            <p className="font-semibold">{studentMap.get(deletingPayment.student_id)?.name || '학생 정보 없음'} · {won(deletingPayment.amount)}</p>
            <p>{classes.find((item) => item.id === deletingPayment.class_id)?.name || '수업 정보 없음'}</p>
            <p>결제일: {deletingPayment.paid_on}</p>
            {deletingPayment.cycle_start && <p>단위기간: {deletingPayment.cycle_start} ~ {deletingPayment.cycle_end}</p>}
          </div>}
          {deletePayment.isError && <p role="alert" className="text-sm text-[#a95848]">{deletePayment.error.message || '결제 내역을 삭제하지 못했어요.'}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" autoFocus disabled={deletePayment.isPending} onClick={() => setDeletingPayment(null)}>취소</Button>
            <Button type="button" variant="destructive" disabled={!deletingPayment || !enabled || deletePayment.isPending} onClick={() => { if (deletingPayment && !deletePayment.isPending) deletePayment.mutate(deletingPayment) }}>{deletePayment.isPending ? '삭제 중...' : '삭제'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  </div>
}
