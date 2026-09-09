import TeacherScope from '../components/TeacherScope'
import ClassTimeSelect from '../components/ClassTimeSelect'
import ScheduleDialog from '../components/ScheduleDialog'
import { layoutTimetableItems, SCHEDULE_COLORS } from '../lib/schedule'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { BookOpen, CalendarDays, Clock3, ArrowUpRight, Check, Plus } from 'lucide-react'
import { toast } from 'sonner'


import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

import BillingFields from '../components/BillingFields'
import { billingError } from '../lib/payments'

const DAYS = [
  { value: 1, label: '월' }, { value: 2, label: '화' }, { value: 3, label: '수' },
  { value: 4, label: '목' }, { value: 5, label: '금' }, { value: 6, label: '토' }, { value: 7, label: '일' },
]
const EARLIEST_START_TIME = '08:00'
const EMPTY_FORM = { name: '', start_time: '', end_time: '', weekdays: [], color_index: 0, billing_cycle_sessions: '', billing_amount: '', billing_start_date: '', memo: '' }
const HOUR_HEIGHT = 64
const CLASS_COLORS = [
  { backgroundColor: '#83cf9c', borderColor: '#b9d5c2', color: '#000000' },
  { backgroundColor: '#8bb8e8', borderColor: '#b9cee5', color: '#000000' },
  { backgroundColor: '#c4a0e6', borderColor: '#d2c3e5', color: '#000000' },
  { backgroundColor: '#e99aa7', borderColor: '#edc2c8', color: '#000000' },
  { backgroundColor: '#e8cc70', borderColor: '#ebd09e', color: '#000000' },
  { backgroundColor: '#79c9bc', borderColor: '#b8dbd8', color: '#000000' },
  { backgroundColor: '#d8b08c', borderColor: '#d7c5b8', color: '#000000' },
  { backgroundColor: '#a0a9e3', borderColor: '#c7cde9', color: '#000000' },
  { backgroundColor: '#b3d579', borderColor: '#d4daa9', color: '#000000' },
  { backgroundColor: '#e8ac7d', borderColor: '#e7c5ad', color: '#000000' },
]
const COLOR_SWATCHES = [
  'bg-[#72ad83]', 'bg-[#70a1ce]', 'bg-[#9b78bd]', 'bg-[#d47b89]', 'bg-[#d8a94f]',
  'bg-[#61aaa5]', 'bg-[#ad8168]', 'bg-[#7888c5]', 'bg-[#98a44d]', 'bg-[#d58659]',
]

function toMinutes(time) {
  const [hour, minute] = time.slice(0, 5).split(':').map(Number)
  return hour * 60 + minute
}

function hasConflict(classes, candidate, editingId = null) {
  const candidateStart = toMinutes(candidate.start_time)
  const candidateEnd = toMinutes(candidate.end_time)
  return classes.some((item) => {
    if (item.id === editingId) return false
    const sharesDay = item.weekdays.some((day) => candidate.weekdays.includes(day))
    const itemStart = toMinutes(item.start_time)
    const itemEnd = toMinutes(item.end_time)
    return sharesDay && candidateStart < itemEnd && candidateEnd > itemStart
  })
}

export default function ClassesPage() {
  const { user, isLoading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isTimetable = pathname === '/'
  const [showAll, setShowAll] = useState(false)
  const [params, setParams] = useSearchParams()
  const [localDialogOpen, setLocalDialogOpen] = useState(false)
  const dialogOpen = localDialogOpen || params.get('action') === 'new'
  function setDialogOpen(open) {
    setLocalDialogOpen(open)
    if (!open && params.has('action')) setParams({}, { replace: true })
  }
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingClass, setEditingClass] = useState(null)
  const [scheduleDialog, setScheduleDialog] = useState(null)

  const profile = useQuery({
    queryKey: ['teacher-profile', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('is_teacher').eq('id', user.id).single()
      if (error) throw error
      return data
    },
  })
  const classes = useQuery({
    queryKey: ['classes', user?.id, showAll],
    enabled: Boolean(user && profile.data?.is_teacher),
    refetchOnMount: 'always',
    queryFn: async () => {
      let request = supabase.from('classes').select('id,teacher_id,name,start_time,end_time,weekdays,color_index,billing_cycle_sessions,billing_amount,billing_start_date,memo').order('start_time')
      if (!showAll) request = request.eq('teacher_id', user.id)
      const { data, error } = await request
      if (error) throw error
      return data
    },
  })
  const schedules = useQuery({
    queryKey: ['schedules', user?.id, showAll],
    enabled: Boolean(isTimetable && user && profile.data?.is_teacher),
    queryFn: async () => {
      let request = supabase.from('schedules').select('id,teacher_id,title,start_time,end_time,weekdays,color_index,memo').order('start_time')
      if (!showAll) request = request.eq('teacher_id', user.id)
      const { data, error } = await request
      if (error) throw error
      return data
    },
  })
  const timetableItems = useMemo(() => [
    ...(classes.data || []).map((item) => ({ ...item, kind: 'class' })),
    ...(isTimetable ? schedules.data || [] : []).map((item) => ({ ...item, name: item.title, kind: 'schedule' })),
  ], [classes.data, schedules.data, isTimetable])
  const saveClass = useMutation({
    mutationFn: async (values) => {
      const colorIndex = values.color_index ?? 0
      const payload = { teacher_id: user.id, name: values.name.trim(), start_time: values.start_time, end_time: values.end_time, weekdays: values.weekdays, color_index: colorIndex, billing_cycle_sessions: Number(values.billing_cycle_sessions), billing_amount: Number(values.billing_amount), billing_start_date: values.billing_start_date, memo: values.memo.trim() || null }
      const request = editingClass
        ? supabase.from('classes').update(payload).eq('id', editingClass.id)
        : supabase.from('classes').insert(payload)
      const { error } = await request
      if (error) throw error
    },
    onSuccess: async () => {
      setDialogOpen(false)
      setForm(EMPTY_FORM)
      setEditingClass(null)
      await queryClient.refetchQueries({ queryKey: ['classes', user.id], type: 'active' })
      toast.success(editingClass ? '수업을 수정했어요.' : '수업을 추가했어요.')
    },
    onError: (error) => toast.error(error.message?.includes('class_time_conflict') ? '이미 같은 시간에 수업이 있어요.' : error.message || '수업을 추가하지 못했어요.'),
  })

  const hours = useMemo(() => {
    const starts = timetableItems.map((item) => toMinutes(item.start_time) / 60)
    const first = starts.length ? Math.min(...starts) : 8
    const ends = timetableItems.map((item) => Math.ceil(toMinutes(item.end_time) / 60))
    const last = Math.max(22, ...ends)
    const wholeHours = Array.from({ length: last - Math.ceil(first) + 1 }, (_, index) => Math.ceil(first) + index)
    return Number.isInteger(first) ? wholeHours : [first, ...wholeHours]
  }, [timetableItems])
  const firstHour = hours[0]
  const calendarHeight = (hours[hours.length - 1] - firstHour) * HOUR_HEIGHT
  const isTeacher = profile.data?.is_teacher === true

  function toggleDay(day) {
    setForm((current) => ({ ...current, weekdays: current.weekdays.includes(day) ? current.weekdays.filter((value) => value !== day) : [...current.weekdays, day].sort() }))
  }

  const requiredFieldsComplete = Boolean(form.name.trim() && form.weekdays.length && form.start_time && form.end_time && String(form.billing_cycle_sessions).trim() && String(form.billing_amount).trim() && form.billing_start_date)
  const formError = !requiredFieldsComplete ? null
    : form.start_time < EARLIEST_START_TIME ? '수업 시작 시간은 오전 8시부터 선택할 수 있어요.'
    : toMinutes(form.end_time) <= toMinutes(form.start_time) ? '종료 시간은 시작 시간보다 늦어야 해요.'
    : ![form.start_time, form.end_time].every((time) => /^(?:[01][0-9]|2[0-3]):(?:00|30)$/.test(time)) ? '시간은 00분 또는 30분으로 선택해 주세요.'
    : billingError(form)

  function submit(event) {
    event.preventDefault()
    if (saveClass.isPending || !requiredFieldsComplete) return
    if (formError) return toast.error(formError)
    if (form.start_time < EARLIEST_START_TIME) return toast.error('수업 시작 시간은 오전 8시부터 선택할 수 있어요.')
    if (!form.weekdays.length) return toast.error('수업 요일을 하나 이상 선택해 주세요.')
    if (toMinutes(form.end_time) <= toMinutes(form.start_time)) return toast.error('종료 시간은 시작 시간보다 늦어야 해요.')
    if (hasConflict((classes.data || []).filter((item) => item.teacher_id === user.id), form, editingClass?.id)) return toast.error('이미 같은 시간에 수업이 있어요.')
    const error = billingError(form)
    if (error) return toast.error(error)
    saveClass.mutate(form)
  }

  function openCreate() {
    setEditingClass(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }


  if (authLoading) return <div className="grid min-h-screen place-items-center bg-[#f7f9f5] text-[#65736b]">불러오는 중...</div>
  if (!user) return <main className="grid min-h-screen place-items-center bg-[#f7f9f5] px-5"><div className="text-center"><h1 className="font-display text-3xl font-bold">로그인이 필요해요</h1><Link className="mt-6 inline-block rounded-sm bg-[#305c45] px-6 py-3 font-bold text-white" to="/login">로그인하기</Link></div></main>

  return <div className="flex min-h-screen flex-col bg-[#f7f9f5] text-[#26372f]">
    
    <main className="mx-auto w-[min(1180px,calc(100%-32px))] py-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="dashboard-page-title inline-page-title">{isTimetable ? '시간표' : '수업 리스트'}</h1>
          <TeacherScope all={showAll} onChange={setShowAll} />
        </div>
        <div className="ml-auto flex items-center gap-2">
        {isTimetable && <Button type="button" variant="outline" className="h-11 border-[#b9d5c2] px-4 text-[#305c45]" disabled={!isTeacher || schedules.isLoading || schedules.isError} onClick={() => setScheduleDialog({ schedule: null })}><CalendarDays />일정 추가</Button>}
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open && !saveClass.isPending) { setForm(EMPTY_FORM); setEditingClass(null) } }}>
          <Button className="h-11 rounded-xl bg-[#305c45] px-4 font-bold text-white hover:bg-[#264c38]" disabled={!isTeacher} onClick={openCreate}><Plus />수업 추가</Button>
          <DialogContent aria-describedby={undefined} className="max-h-[calc(100vh-32px)] overflow-y-auto rounded-3xl p-6 sm:max-w-3xl sm:p-8 lg:max-w-4xl">
            <DialogHeader><DialogTitle className="font-display text-2xl font-bold">{editingClass ? '수업 수정' : '새 수업 추가'}</DialogTitle></DialogHeader>
            <form className="mt-5 space-y-5" onSubmit={submit}>
              <div className="grid gap-7 md:grid-cols-2 md:gap-8">
              <div className="min-w-0 space-y-5">
              <div className="space-y-2"><Label htmlFor="class-name">수업 이름 *</Label><Input autoFocus className="h-11 rounded-xl" id="class-name" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="예: 중등 수학 A반" required value={form.name} /></div>
              <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="start-time">시작 시간 *</Label><ClassTimeSelect id="start-time" value={form.start_time} onChange={(value) => setForm((current) => ({ ...current, start_time: value }))} /><p className="text-xs text-[#879189]">오전 8시부터 선택할 수 있어요.</p></div><div className="space-y-2"><Label htmlFor="end-time">종료 시간 *</Label><ClassTimeSelect id="end-time" value={form.end_time} after={form.start_time} onChange={(value) => setForm((current) => ({ ...current, end_time: value }))} /></div></div>
              <fieldset><legend className="mb-2 text-sm font-medium">요일 *</legend><div className="grid grid-cols-7 gap-1.5">{DAYS.map((day) => <Button aria-pressed={form.weekdays.includes(day.value)} className={`h-10 px-0 ${form.weekdays.includes(day.value) ? 'bg-[#305c45] text-white hover:bg-[#264c38]' : ''}`} key={day.value} onClick={() => toggleDay(day.value)} type="button" variant={form.weekdays.includes(day.value) ? 'default' : 'outline'}>{day.label}</Button>)}</div></fieldset>
              <fieldset><legend className="mb-2 text-sm font-medium">수업 색상</legend><div className="flex flex-wrap items-center gap-2">{COLOR_SWATCHES.map((color, index) => <button aria-label={`${index + 1}번 색상`} aria-pressed={form.color_index === index} className={`grid h-9 w-9 place-items-center rounded-full border-2 text-white transition ${color} ${form.color_index === index ? 'border-white ring-2 ring-[#305c45]' : 'border-transparent hover:scale-105'}`} key={color} onClick={() => setForm((current) => ({ ...current, color_index: index }))} type="button">{form.color_index === index && <Check className="h-4 w-4" />}</button>)}</div></fieldset>
              </div>
              <div className="min-w-0 space-y-5">
              <BillingFields form={form} setForm={setForm} />
              <div className="space-y-2"><Label htmlFor="new-class-memo">수업 메모 <span className="font-normal text-[#879189]">(선택)</span></Label><textarea id="new-class-memo" rows={4} maxLength={5000} value={form.memo} onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))} placeholder="수업 진도, 준비할 내용, 참고 사항을 기록해 주세요." className="w-full resize-y rounded-xl border border-[#dce4dc] bg-white p-3 text-sm leading-6 outline-none focus:border-[#527b65] focus:ring-2 focus:ring-[#527b65]/10" /><p className="text-right text-xs text-[#879189]">{form.memo.length.toLocaleString()} / 5,000</p></div>
              </div>
              </div>
              {formError && <p role="status" className="text-xs leading-5 text-[#758078]">{formError}</p>}
              <DialogFooter className="mx-0 mb-0 mt-7 border-0 bg-transparent p-0"><Button className="h-11 rounded-xl px-5 font-bold" onClick={() => setDialogOpen(false)} type="button" variant="outline">취소</Button><Button className="h-11 rounded-xl bg-[#305c45] px-5 font-bold text-white hover:bg-[#264c38]" disabled={saveClass.isPending || !isTeacher || !requiredFieldsComplete || Boolean(formError)} type="submit">{saveClass.isPending ? '저장 중...' : editingClass ? '변경 저장' : '추가하기'}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {profile.isError && <div className="mb-6 rounded-2xl bg-[#fff2ee] p-4 text-sm text-[#9a4936]">교사 정보를 확인하지 못했어요.</div>}
      {!profile.isLoading && !isTeacher && !profile.isError && <div className="mb-6 rounded-2xl bg-[#fff7df] p-4 text-sm text-[#795f1c]">교사로 승인된 계정만 수업을 관리할 수 있어요.</div>}

      {!isTimetable ? <TooltipProvider><section className="class-list-panel">
        <div className="class-list-heading"><span>총 {classes.data?.length ?? 0}개</span><span>요일 · 시간</span></div>
        {classes.isLoading || profile.isLoading ? <p className="p-12 text-center text-sm text-[#879189]">수업을 불러오는 중...</p> : classes.isError ? <div className="p-12 text-center"><p>수업을 불러오지 못했어요.</p><Button className="mt-4" variant="outline" onClick={() => classes.refetch()}>다시 불러오기</Button></div> : !classes.data?.length ? <div className="p-16 text-center"><BookOpen className="mx-auto mb-4 text-[#a5b6aa]" size={32} /><p className="font-semibold">아직 등록된 수업이 없어요</p><p className="mt-2 text-sm text-[#879189]">첫 수업을 추가하고 시간표를 채워 보세요.</p><Button disabled={!isTeacher} className="mt-5" variant="outline" onClick={openCreate}><Plus size={16} />수업 추가하기</Button></div> : classes.data.map((item) => <Link className="class-list-row" key={item.id} to={'/classes/' + item.id}><span className="class-color" style={{ backgroundColor: CLASS_COLORS[(item.color_index ?? 0) % CLASS_COLORS.length].borderColor }} /><div className="min-w-0 flex-1"><strong className="block truncate">{item.name}</strong>{item.memo && <Tooltip><TooltipTrigger asChild><span tabIndex={0} className="mt-1 block max-w-64 truncate text-xs text-[#879189] focus-visible:outline-2 focus-visible:outline-[#527b65]">{item.memo}</span></TooltipTrigger><TooltipContent side="top" sideOffset={8} className="max-h-72 max-w-[min(360px,calc(100vw-32px))] overflow-y-auto whitespace-pre-wrap break-words border-black bg-black px-3 py-2 text-sm leading-6 text-white [&>svg]:fill-black [&>svg]:bg-black">{item.memo}</TooltipContent></Tooltip>}</div><span className="class-days">{DAYS.filter((day) => item.weekdays.includes(day.value)).map((day) => day.label).join(' · ')}</span><span className="class-time"><Clock3 size={15} />{item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)}</span><ArrowUpRight size={17} className="text-[#94a097]" /></Link>)}
      </section></TooltipProvider> : <>
      {schedules.isError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#fff2ee] p-4 text-sm text-[#9a4936]"><span>일정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</span><Button variant="outline" type="button" onClick={() => schedules.refetch()}>다시 불러오기</Button></div>}
      {!classes.isLoading && !classes.isError && !schedules.isLoading && !schedules.isError && isTeacher && timetableItems.length === 0 && <div className="schedule-empty"><CalendarDays size={19} /><span>등록된 수업이나 일정이 없어요. 위 버튼으로 추가해 주세요.</span></div>}
      <section className="overflow-hidden rounded-3xl border border-[#e1e7df] bg-white shadow-sm">
        {classes.isLoading ? <p className="p-16 text-center text-sm text-[#879189]">수업을 불러오는 중...</p> : classes.isError ? <div className="p-12 text-center"><p className="font-semibold text-[#a95848]">수업을 불러오지 못했어요.</p><p className="mt-2 text-xs text-[#8e6259]">{classes.error?.message}</p></div> : <TooltipProvider><div className="overflow-x-auto"><div className="w-full min-w-[780px]">
          <div className="grid border-b border-[#e8ece7] bg-[#fafbf9]" style={{ gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))' }}><div className="grid place-items-center text-[10px] font-semibold text-[#a1aaa4]">시간</div>{DAYS.map((day) => <div className={`border-l border-[#edf0eb] py-4 text-center text-sm font-bold ${day.value === 6 ? 'bg-[#f5f8f5] text-[#527b65]' : day.value === 7 ? 'bg-[#fff8f6] text-[#b66b5d]' : ''}`} key={day.value}>{day.label}</div>)}</div>
          <div className="timetable-grid grid" style={{ gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))', '--timetable-grid-offset': `${-(firstHour % 1) * HOUR_HEIGHT}px` }}>
            <div className="relative" style={{ height: calendarHeight }}>{hours.slice(0, -1).map((hour, index) => <span className={`absolute right-3 text-xs text-[#929b95] ${index === 0 ? 'translate-y-1' : '-translate-y-1/2'}`} key={hour} style={{ top: (hour - firstHour) * HOUR_HEIGHT }}>{String(Math.floor(hour)).padStart(2, '0')}:{String(Math.round((hour % 1) * 60)).padStart(2, '0')}</span>)}</div>
            {DAYS.map((day) => <div className={`relative border-l border-[#edf0eb] bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_63px,#edf0eb_64px)] ${day.value === 6 ? 'bg-[#fbfdfb]' : day.value === 7 ? 'bg-[#fffcfb]' : ''}`} key={day.value} style={{ height: calendarHeight }}>{layoutTimetableItems(timetableItems.filter((item) => item.weekdays.includes(day.value))).map((item) => { const top = ((toMinutes(item.start_time) - firstHour * 60) / 60) * HOUR_HEIGHT; const height = ((toMinutes(item.end_time) - toMinutes(item.start_time)) / 60) * HOUR_HEIGHT; const color = { backgroundColor: SCHEDULE_COLORS[(item.color_index ?? 0) % SCHEDULE_COLORS.length], color: '#000000' }; return <Tooltip key={item.kind + item.id}><TooltipTrigger asChild><button aria-label={`${item.name} 상세 보기`} className="timetable-class-block absolute flex min-w-0 items-center justify-center overflow-hidden border-0 px-2.5 text-center transition hover:brightness-95 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[#305c45]" onClick={() => item.kind === 'schedule' ? setScheduleDialog({ schedule: item }) : navigate(`/classes/${item.id}`)} style={{ ...color, boxSizing: 'border-box', left: `${item.lane * 100 / item.laneCount}%`, width: `${100 / item.laneCount}%`, top, height }} type="button"><strong className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-xs">{item.kind === 'schedule' && <CalendarDays aria-hidden="true" className="mr-1 inline-block size-3" />}{item.name}</strong></button></TooltipTrigger><TooltipContent className="border-black bg-black text-white [&>svg]:fill-black [&>svg]:bg-black" side="top" sideOffset={6}><p>{item.kind === 'schedule' ? '일정' : '수업'} · {item.name}</p><p>{item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)}</p>{item.kind === 'schedule' && item.memo && <p className="mt-1 max-w-64 whitespace-pre-wrap break-words">{item.memo}</p>}</TooltipContent></Tooltip> })}</div>)}
          </div>
        </div></div></TooltipProvider>}
      </section>
      </>}
    </main>
    {scheduleDialog && <ScheduleDialog schedule={scheduleDialog.schedule} userId={user.id} onClose={() => setScheduleDialog(null)} />}
    
  </div>
}
