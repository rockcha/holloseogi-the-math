/* eslint-disable react/prop-types */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { supabase } from '../lib/supabase'
import { calendarEventError } from '../lib/calendar'

export default function CalendarEventDialog({ event, date, userId, onClose }) {
  const client = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState(() => ({ title: event?.title || '', memo: event?.memo || '', event_date: event?.event_date || date,
    allDay: !event?.start_time, start_time: event?.start_time?.slice(0, 5) || '', end_time: event?.end_time?.slice(0, 5) || '' }))
  const error = calendarEventError(form)
  const mutation = useMutation({
    mutationFn: async (action) => {
      if (action !== 'delete' && error) throw new Error(error)
      if (event && event.teacher_id !== userId) throw new Error('본인의 일정만 수정할 수 있어요.')
      const values = { title: form.title.trim(), memo: form.memo.trim() || null, event_date: form.event_date, teacher_id: userId,
        start_time: form.allDay ? null : form.start_time, end_time: form.allDay ? null : form.end_time }
      let request
      if (action === 'delete') {
        if (!event) throw new Error('삭제할 일정을 선택해 주세요.')
        request = supabase.from('calendar_events').delete().eq('id', event.id).eq('teacher_id', userId)
      } else request = event ? supabase.from('calendar_events').update(values).eq('id', event.id).eq('teacher_id', userId) : supabase.from('calendar_events').insert(values)
      const { error: requestError } = await request.select('id').single()
      if (requestError) throw requestError
      return action
    },
    onSuccess: async (action) => {
      await client.invalidateQueries({ queryKey: ['calendar-events', userId] })
      toast.success(action === 'delete' ? '일정을 삭제했어요.' : event ? '일정을 수정했어요.' : '일정을 추가했어요.')
      onClose()
    },
    onError: () => toast.error('일정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'),
  })
  function update(key, value) { setForm((current) => ({ ...current, [key]: value })); setConfirmDelete(false) }
  return <Dialog open onOpenChange={(open) => { if (!open && !mutation.isPending) onClose() }}>
    <DialogContent className="max-h-[calc(100dvh-32px)] overflow-y-auto p-6 sm:max-w-md">
      <DialogHeader><DialogTitle className="font-display text-2xl">{event ? '일정 수정' : '일정 추가'}</DialogTitle><DialogDescription>날짜를 선택하고 제목을 적어 주세요.</DialogDescription></DialogHeader>
      <form className="mt-3 space-y-5" onSubmit={(e) => { e.preventDefault(); if (!error && !mutation.isPending) mutation.mutate('save') }}>
        <fieldset disabled={mutation.isPending} className="space-y-5">
          <div className="space-y-2"><Label htmlFor="calendar-title">제목</Label><Input id="calendar-title" autoFocus required maxLength={100} placeholder="일정 제목" value={form.title} onChange={(e) => update('title', e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="calendar-date">날짜</Label><Input id="calendar-date" type="date" required value={form.event_date} onChange={(e) => update('event_date', e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[#305c45]" checked={form.allDay} onChange={(e) => update('allDay', e.target.checked)} />시간제한 없음</label>
          {!form.allDay && <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="calendar-start">시작 시간</Label><Input id="calendar-start" type="time" required step={60} value={form.start_time} onChange={(e) => update('start_time', e.target.value)} /></div><div className="space-y-2"><Label htmlFor="calendar-end">종료 시간</Label><Input id="calendar-end" type="time" required step={60} value={form.end_time} onChange={(e) => update('end_time', e.target.value)} /></div></div>}
          <div className="space-y-2"><Label htmlFor="calendar-memo">메모 <span className="font-normal text-[#879189]">(선택)</span></Label><textarea id="calendar-memo" rows={5} maxLength={5000} placeholder="일정에 필요한 내용을 적어 주세요." value={form.memo} onChange={(e) => update('memo', e.target.value)} className="w-full resize-y rounded-lg border border-input bg-white p-3 text-sm leading-6 outline-none focus:border-[#527b65]" /><p className="text-right text-xs text-[#879189]">{form.memo.length.toLocaleString()} / 5,000</p></div>
        </fieldset>
        {!form.allDay && form.start_time && form.end_time && error && <p role="alert" className="text-sm text-[#a95848]">{error}</p>}
        {confirmDelete && <p role="alert" className="text-sm text-[#a95848]">이 일정을 삭제하려면 ‘삭제 확인’을 누르세요.</p>}
        <DialogFooter>
          {event && <Button className="sm:mr-auto" variant="destructive" type="button" disabled={mutation.isPending} onClick={() => confirmDelete ? mutation.mutate('delete') : setConfirmDelete(true)}>{confirmDelete ? '삭제 확인' : '삭제'}</Button>}
          <Button variant="outline" type="button" disabled={mutation.isPending} onClick={onClose}>취소</Button>
          <Button className="bg-[#305c45] text-white hover:bg-[#264c38]" type="submit" disabled={Boolean(error) || mutation.isPending}>{mutation.isPending ? '처리 중...' : '저장'}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
