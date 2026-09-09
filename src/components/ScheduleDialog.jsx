/* eslint-disable react/prop-types */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { supabase } from '../lib/supabase'
import { scheduleError, SCHEDULE_COLORS, SCHEDULE_DAYS } from '../lib/schedule'

export default function ScheduleDialog({ schedule, userId, onClose }) {
  const client = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState(() => schedule ? {
    title: schedule.title, memo: schedule.memo || '', weekdays: schedule.weekdays,
    start_time: schedule.start_time.slice(0, 5), end_time: schedule.end_time.slice(0, 5), color_index: schedule.color_index,
  } : { title: '', memo: '', weekdays: [], start_time: '', end_time: '', color_index: 0 })
  const readOnly = Boolean(schedule && schedule.teacher_id !== userId)
  const error = scheduleError(form)
  const save = useMutation({
    mutationFn: async () => {
      if (readOnly) throw new Error('작성자만 일정을 수정할 수 있어요.')
      if (error) throw new Error(error)
      const values = { ...form, title: form.title.trim(), memo: form.memo.trim() || null, teacher_id: userId }
      const request = schedule
        ? supabase.from('schedules').update(values).eq('id', schedule.id).eq('teacher_id', userId)
        : supabase.from('schedules').insert(values)
      const { error: saveError } = await request.select('id').single()
      if (saveError) throw saveError
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['schedules'] })
      toast.success(schedule ? '일정을 수정했어요.' : '일정을 추가했어요.')
      onClose()
    },
    onError: () => toast.error('일정을 저장하지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요.'),
  })
  const remove = useMutation({
    mutationFn: async () => {
      if (readOnly || !schedule) throw new Error('삭제할 수 없는 일정이에요.')
      const { error: deleteError } = await supabase.from('schedules').delete().eq('id', schedule.id).eq('teacher_id', userId).select('id').single()
      if (deleteError) throw deleteError
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['schedules'] })
      toast.success('일정을 삭제했어요.')
      onClose()
    },
    onError: () => toast.error('일정을 삭제하지 못했어요. 다시 시도해 주세요.'),
  })
  const busy = save.isPending || remove.isPending
  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    setConfirmDelete(false)
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
    <DialogContent className="max-h-[calc(100dvh-32px)] overflow-y-auto p-6 sm:max-w-xl">
      <DialogHeader><DialogTitle className="font-display text-2xl">{readOnly ? '일정 보기' : schedule ? '일정 수정' : '일정 추가'}</DialogTitle><DialogDescription>반복되는 일정을 추가하세요</DialogDescription></DialogHeader>
      <form className="mt-3 space-y-5" onSubmit={(event) => { event.preventDefault(); if (!busy && !readOnly && !error) save.mutate() }}>
        <fieldset disabled={busy || readOnly} className="space-y-5">
          <div className="space-y-2"><Label htmlFor="schedule-title">제목</Label><Input autoFocus id="schedule-title" required maxLength={100} value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="예: 학부모 상담" /></div>
          <fieldset><legend className="mb-2 text-sm font-medium">요일</legend><div className="grid grid-cols-7 gap-1.5">{SCHEDULE_DAYS.map((day, index) => <Button key={day} type="button" aria-pressed={form.weekdays.includes(index + 1)} variant={form.weekdays.includes(index + 1) ? 'default' : 'outline'} className={`h-10 px-0 ${form.weekdays.includes(index + 1) ? 'bg-[#305c45] text-white hover:bg-[#264c38]' : ''}`} onClick={() => update('weekdays', form.weekdays.includes(index + 1) ? form.weekdays.filter((value) => value !== index + 1) : [...form.weekdays, index + 1].sort())}>{day}</Button>)}</div></fieldset>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="schedule-start">시작 시간</Label><Input id="schedule-start" type="time" required step={60} value={form.start_time} onChange={(event) => update('start_time', event.target.value)} /></div><div className="space-y-2"><Label htmlFor="schedule-end">종료 시간</Label><Input id="schedule-end" type="time" required step={60} value={form.end_time} onChange={(event) => update('end_time', event.target.value)} /></div></div>
          <fieldset><legend className="mb-2 text-sm font-medium">색상</legend><div className="flex flex-wrap gap-2">{SCHEDULE_COLORS.map((color, index) => <button key={color} type="button" aria-label={`색상 ${index + 1}`} aria-pressed={form.color_index === index} className="grid size-9 place-items-center border-2 border-transparent text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#305c45]" style={{ backgroundColor: color }} onClick={() => update('color_index', index)}>{form.color_index === index && <Check size={18} />}</button>)}</div></fieldset>
          <div className="space-y-2"><Label htmlFor="schedule-memo">메모 <span className="font-normal text-[#879189]">(선택)</span></Label><textarea id="schedule-memo" rows={4} maxLength={5000} value={form.memo} onChange={(event) => update('memo', event.target.value)} placeholder="일정에 필요한 내용을 적어 주세요." className="w-full resize-y rounded-lg border border-input bg-white p-3 text-sm leading-6 outline-none focus:border-[#527b65]" /></div>
        </fieldset>
        {!readOnly && form.start_time && form.end_time && form.end_time <= form.start_time && <p role="alert" className="text-sm text-[#a95848]">종료 시간은 시작 시간보다 늦어야 해요.</p>}
        {confirmDelete && <div role="alert" className="rounded-lg bg-[#fff2ee] p-3 text-sm text-[#9a4936]">이 일정을 삭제할까요? <button type="button" className="ml-2 underline" disabled={busy} onClick={() => setConfirmDelete(false)}>취소</button></div>}
        <DialogFooter className="gap-2">
          {schedule && !readOnly && <Button type="button" variant="destructive" className="sm:mr-auto" disabled={busy} onClick={() => confirmDelete ? remove.mutate() : setConfirmDelete(true)}><Trash2 size={16} />{remove.isPending ? '삭제 중...' : confirmDelete ? '삭제 확인' : '삭제'}</Button>}
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{readOnly ? '닫기' : '취소'}</Button>
          {!readOnly && <Button type="submit" disabled={busy || Boolean(error)} className="bg-[#305c45] text-white hover:bg-[#264c38]">{save.isPending ? '저장 중...' : schedule ? '수정하기' : '추가하기'}</Button>}
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
