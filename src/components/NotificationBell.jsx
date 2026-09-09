/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Popover } from 'radix-ui'
import { Bell, CalendarDays, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from './ui/button'
import { supabase } from '../lib/supabase'

export default function NotificationBell({ userId }) {
  const [open, setOpen] = useState(false)
  const announced = useRef(new Set())
  const client = useQueryClient()
  const queryKey = ['daily-notification', userId]
  const notification = useQuery({
    queryKey,
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_today_notification')
      if (error) throw error
      return data?.[0] || null
    },
    staleTime: 0,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
  const current = notification.data
  const unread = Boolean(current && !current.read_at)
  const summary = current ? `오늘 수업 ${current.class_count}개, 일정 ${current.schedule_count}개가 있습니다.` : ''
  const markRead = useMutation({
    mutationFn: async (id) => {
      const { data, error } = await supabase.from('daily_notifications').update({ read_at: new Date().toISOString() })
        .eq('id', id).eq('user_id', userId).select('id,read_at').single()
      if (error) throw error
      return data
    },
    onSuccess: async (row) => {
      await client.cancelQueries({ queryKey })
      client.setQueryData(queryKey, (latest) => latest?.id === row.id ? { ...latest, read_at: row.read_at } : latest)
    },
  })
  const { mutate, isPending, isError } = markRead
  useEffect(() => {
    if (open && unread && !isPending && !isError) mutate(current.id)
  }, [open, unread, current?.id, isPending, isError, mutate])
  useEffect(() => {
    if (!current || !unread || announced.current.has(current.id)) return
    announced.current.add(current.id)
    if (!open) toast(summary, { id: `daily-${current.id}`, icon: <Bell size={18} />, duration: 6000 })
  }, [current, unread, open, summary])

  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger asChild><Button type="button" variant="ghost" size="icon" aria-label={unread ? '알림, 읽지 않은 알림 있음' : '알림'} className="relative size-10 text-[#52635a] hover:bg-[#f1f5f0]"><Bell className="size-5" strokeWidth={1.7} />{unread && <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#e45454] ring-2 ring-white" />}</Button></Popover.Trigger>
    <Popover.Portal><Popover.Content side="bottom" align="end" sideOffset={10} collisionPadding={16} aria-label="알림 목록" className="z-50 w-80 max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-[#e1e7df] bg-white p-4 shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-semibold text-[#26372f]">알림</h2><Popover.Close asChild><Button variant="ghost" size="icon-sm" aria-label="알림 닫기"><X size={16} /></Button></Popover.Close></div>
      {notification.isLoading ? <p role="status" className="py-5 text-center text-sm text-[#879189]">알림을 확인하는 중...</p>
        : notification.isError ? <div role="alert" className="space-y-3 py-3 text-sm text-[#879189]"><p>알림을 불러오지 못했어요.</p><Button variant="outline" size="sm" onClick={() => notification.refetch()}>다시 불러오기</Button></div>
          : !current ? <p className="py-5 text-sm leading-6 text-[#879189]">새 알림이 없어요.<br />오늘의 요약은 매일 오전 8시부터 표시됩니다.</p>
            : <div className="rounded-lg bg-[#f0f6f1] p-4"><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#305c45]"><CalendarDays size={16} />오늘의 수업과 일정</div><p className="text-sm leading-6 text-[#26372f]">{summary}</p><p className="mt-2 text-xs text-[#879189]">{current.notification_date.replaceAll('-', '. ')} · 오전 8:00</p><div className="mt-4 flex gap-4 text-xs font-semibold text-[#305c45]"><Link to="/" onClick={() => setOpen(false)} className="underline underline-offset-4">시간표 보기</Link><Link to="/calendar" onClick={() => setOpen(false)} className="underline underline-offset-4">달력 보기</Link></div></div>}
      {isError && unread && <div role="alert" className="mt-3 flex items-center justify-between gap-2 text-xs text-[#9a4936]"><span>읽음 상태를 저장하지 못했어요.</span><Button variant="ghost" size="sm" disabled={isPending} onClick={() => mutate(current.id)}>다시 시도</Button></div>}
    </Popover.Content></Popover.Portal>
  </Popover.Root>
}
