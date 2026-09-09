/* eslint-disable react/prop-types */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import CalendarEventDialog from './CalendarEventDialog'
import { supabase } from '../lib/supabase'
import { calendarEntries, dateKey, monthDays } from '../lib/calendar'

const DAYS = ['월', '화', '수', '목', '금', '토', '일']
const entryClass = (item) => item.kind === 'class' ? 'bg-[#e0eee4] text-[#305c45]' : 'bg-[#e9e4f5] text-[#66508b]'
const timeLabel = (item) => item.start_time ? `${item.start_time.slice(0, 5)}–${item.end_time.slice(0, 5)}` : '시간제한 없음'

export default function MonthCalendar({ userId, classes, enabled, classesLoading, classesError }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selected, setSelected] = useState(() => dateKey(new Date()))
  const [dialog, setDialog] = useState(null)
  const [dayOpen, setDayOpen] = useState(false)
  const days = useMemo(() => monthDays(month), [month])
  const start = dateKey(days[0])
  const end = dateKey(days[days.length - 1])
  const today = dateKey(new Date())
  const events = useQuery({
    queryKey: ['calendar-events', userId, start, end],
    enabled: Boolean(userId && enabled),
    queryFn: async () => {
      const { data, error } = await supabase.from('calendar_events').select('id,teacher_id,title,event_date,start_time,end_time,memo')
        .eq('teacher_id', userId).gte('event_date', start).lte('event_date', end).order('event_date').order('start_time')
      if (error) throw error
      return data
    },
  })
  const ownClasses = useMemo(() => classes.filter((item) => item.teacher_id === userId), [classes, userId])
  const selectedEntries = calendarEntries(new Date(`${selected}T12:00:00`), ownClasses, events.data || [])
  const loading = classesLoading || events.isLoading
  const canAdd = enabled && !events.isLoading && !events.isError
  function changeMonth(delta) {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1)
    setMonth(next)
    setSelected(dateKey(next))
  }
  function selectDay(date) {
    setSelected(dateKey(date))
    setDayOpen(true)
    if (date.getMonth() !== month.getMonth() || date.getFullYear() !== month.getFullYear()) setMonth(new Date(date.getFullYear(), date.getMonth(), 1))
  }
  function goToday() {
    const current = new Date()
    setMonth(new Date(current.getFullYear(), current.getMonth(), 1))
    setSelected(dateKey(current))
  }
  return <section aria-labelledby="month-calendar-title">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 id="month-calendar-title" className="dashboard-page-title inline-page-title">일정</h1>
      <Button className="h-11 bg-[#305c45] text-white hover:bg-[#264c38]" disabled={!canAdd} onClick={() => setDialog({ date: selected })}><Plus />일정 추가</Button>
    </div>
    <div className="overflow-hidden rounded-xl border border-[#e1e7df] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e1e7df] p-4 sm:p-5">
        <div className="flex items-center gap-2"><Button variant="ghost" size="icon" aria-label="이전 달" onClick={() => changeMonth(-1)}><ChevronLeft /></Button><h3 aria-live="polite" className="min-w-32 text-center font-display text-xl">{month.getFullYear()}년 {month.getMonth() + 1}월</h3><Button variant="ghost" size="icon" aria-label="다음 달" onClick={() => changeMonth(1)}><ChevronRight /></Button><Button variant="outline" size="sm" onClick={goToday}>오늘</Button></div>
        <div className="flex gap-4 text-xs text-[#758078]"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#83cf9c]" />내 수업</span><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#b39bd8]" />내 일정</span></div>
      </div>
      {events.isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 bg-[#fff2ee] p-4 text-sm text-[#9a4936]"><span>일정을 불러오지 못했어요.</span><Button variant="outline" size="sm" onClick={() => events.refetch()}>다시 불러오기</Button></div>}
      {classesError && <p role="alert" className="bg-[#fff2ee] p-4 text-sm text-[#9a4936]">수업을 불러오지 못했어요. 시간표를 다시 확인해 주세요.</p>}
      {loading && <p role="status" className="px-4 py-2 text-xs text-[#758078]">일정을 불러오는 중...</p>}
      <div className="grid grid-cols-7 border-b border-[#e1e7df] bg-[#fafbf9]">{DAYS.map((day, index) => <div key={day} className={`py-3 text-center text-xs font-medium ${index === 6 ? 'text-[#b66b5d]' : index === 5 ? 'text-[#527b65]' : 'text-[#758078]'}`}>{day}</div>)}</div>
      <div className="grid grid-cols-7" aria-busy={loading}>
        {days.map((date) => {
          const key = dateKey(date)
          const entries = calendarEntries(date, ownClasses, events.data || [])
          const currentMonth = date.getMonth() === month.getMonth()
          return <div key={key} className={`min-h-28 min-w-0 border-b border-r border-[#edf0eb] p-1 last:border-r-0 sm:min-h-36 sm:p-2 ${selected === key ? 'bg-[#f0f6f1] ring-1 ring-inset ring-[#89aa93]' : currentMonth ? 'bg-white' : 'bg-[#f7f8f6]'}`}>
            <button type="button" aria-label={`${key} 일정 보기`} aria-pressed={selected === key} aria-current={key === today ? 'date' : undefined} onClick={() => selectDay(date)} className={`mb-1 flex h-7 w-full items-center justify-center text-xs focus-visible:outline-2 focus-visible:outline-[#527b65] sm:w-8 ${key === today ? 'bg-[#305c45] font-bold text-white' : !currentMonth ? 'text-[#aeb7b0]' : date.getDay() === 0 ? 'text-[#b66b5d]' : 'text-[#44574b]'}`}>{date.getDate()}</button>
            <div className="space-y-1">{entries.slice(0, 3).map((item) => item.kind === 'class'
              ? <Link key={`class-${item.id}`} to={`/classes/${item.id}`} title={`${item.title} · ${timeLabel(item)}`} className={`block truncate px-1 py-1 text-[10px] sm:text-xs ${entryClass(item)}`}><span className="mr-1 hidden tabular-nums lg:inline">{item.start_time.slice(0, 5)}</span>{item.title}</Link>
              : <button key={`event-${item.id}`} type="button" title={`${item.title} · ${timeLabel(item)}`} className={`block w-full truncate px-1 py-1 text-left text-[10px] sm:text-xs ${entryClass(item)}`} onClick={() => setDialog({ event: item, date: key })}><span className="mr-1 hidden tabular-nums lg:inline">{item.start_time?.slice(0, 5) || '시간제한 없음'}</span>{item.title}</button>)}
              {entries.length > 3 && <button type="button" className="w-full py-1 text-left text-[10px] text-[#65736b] sm:text-xs" aria-label={`${key} 일정 ${entries.length}개 모두 보기`} onClick={() => selectDay(date)}>+{entries.length - 3}개 더 보기</button>}
            </div>
          </div>
        })}
      </div>
    </div>
    <Dialog open={dayOpen && !dialog} onOpenChange={setDayOpen}>
      <DialogContent className="max-h-[calc(100dvh-32px)] overflow-y-auto p-6 sm:max-w-lg">
        <DialogHeader><DialogTitle className="font-display text-xl">{selected.replaceAll('-', '. ')} 일정</DialogTitle><DialogDescription>수업과 일정을 확인하고, 일정을 선택해 수정할 수 있어요.</DialogDescription></DialogHeader>
        {loading && <p role="status" className="py-3 text-sm text-[#879189]">일정을 불러오는 중...</p>}
        {!loading && (events.isError || classesError) && <p role="alert" className="text-sm text-[#9a4936]">일부 정보를 불러오지 못했어요. 달력에서 다시 불러오기를 눌러 주세요.</p>}
        {!selectedEntries.length && !loading && !events.isError && !classesError && <p className="py-3 text-sm text-[#879189]">등록된 수업이나 일정이 없어요.</p>}
        <div className="space-y-2">{selectedEntries.map((item) => {
          const content = <><span className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{timeLabel(item)}</span><span>{item.kind === 'class' ? '수업' : '일정'}</span></span><span className="mt-1 block break-words text-sm font-medium">{item.title}</span>{item.memo && <span className="mt-2 block whitespace-pre-wrap break-words text-sm leading-6">{item.memo}</span>}</>
          return item.kind === 'class' ? <Link key={`class-${item.id}`} to={`/classes/${item.id}`} className={`block rounded-lg px-3 py-3 ${entryClass(item)}`}>{content}</Link>
            : <button key={`event-${item.id}`} type="button" onClick={() => setDialog({ event: item, date: selected })} className={`block w-full rounded-lg px-3 py-3 text-left ${entryClass(item)}`}>{content}</button>
        })}</div>
        <Button className="mt-2 bg-[#305c45] text-white hover:bg-[#264c38]" disabled={!canAdd} onClick={() => setDialog({ date: selected })}><Plus size={16} />일정 추가</Button>
      </DialogContent>
    </Dialog>
    {dialog && <CalendarEventDialog event={dialog.event} date={dialog.date} userId={userId} onClose={() => setDialog(null)} />}
  </section>
}
