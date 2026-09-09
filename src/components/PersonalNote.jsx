/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, GripHorizontal, Smile, StickyNote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { supabase } from '../lib/supabase'

const emojis = ['😀', '😊', '❤️', '👍', '👏', '🎉', '⭐', '🔥', '💡', '📌', '📚', '✏️', '✅', '❗', '📅', '🎯']

export default function PersonalNote({ userId }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [position, setPosition] = useState(null)
  const panel = useRef(null)
  const drag = useRef(null)
  const editor = useRef(null)
  const selection = useRef({ start: 0, end: 0 })
  const client = useQueryClient()
  const queryKey = ['personal-note', userId]
  const note = useQuery({
    queryKey,
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from('user_notes').select('content').eq('user_id', userId).maybeSingle()
      if (error) throw error
      return data?.content ?? ''
    },
  })
  const save = useMutation({
    mutationFn: async (content) => {
      const { data, error } = await supabase.from('user_notes').upsert({ user_id: userId, content }, { onConflict: 'user_id' }).select('content').single()
      if (error) throw error
      return data.content
    },
    onSuccess: (content) => {
      client.setQueryData(queryKey, content)
      setDraft((latest) => latest === content ? null : latest)
    },
  })
  const value = draft ?? note.data ?? ''
  const disabled = note.isPending || note.isError
  const dirty = draft !== null && draft !== (note.data ?? '')
  const { mutate, isPending: saving, isError: saveError } = save

  function movePanel(x, y) {
    const bounds = panel.current?.getBoundingClientRect()
    if (!bounds) return
    setPosition({
      x: Math.max(16, Math.min(x, window.innerWidth - bounds.width - 16)),
      y: Math.max(16, Math.min(y, window.innerHeight - bounds.height - 16)),
    })
  }

  useEffect(() => {
    if (!open) return
    const resize = () => {
      const bounds = panel.current?.getBoundingClientRect()
      if (bounds) movePanel(bounds.x, bounds.y)
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [open])

  function startDrag(event) {
    if (event.button !== 0) return
    const bounds = panel.current.getBoundingClientRect()
    drag.current = { x: event.clientX - bounds.x, y: event.clientY - bounds.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveWithKeys(event) {
    const delta = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }[event.key]
    if (!delta) return
    event.preventDefault()
    const bounds = panel.current.getBoundingClientRect()
    movePanel(bounds.x + delta[0], bounds.y + delta[1])
  }

  useEffect(() => {
    if (!dirty || disabled || saving || saveError) return
    const timer = setTimeout(() => mutate(draft), open ? 700 : 0)
    return () => clearTimeout(timer)
  }, [draft, dirty, disabled, saving, saveError, mutate, open])

  function updateDraft(content) {
    if (save.isError) save.reset()
    setDraft(content)
  }

  function insert(text, linePrefix = false) {
    const { start, end } = selection.current
    const from = linePrefix ? value.lastIndexOf('\n', start - 1) + 1 : start
    const replacement = linePrefix ? value.slice(from, end).split('\n').map((line) => text + line).join('\n') : text
    const next = value.slice(0, from) + replacement + value.slice(end)
    if (next.length > 10000) return
    updateDraft(next)
    setShowEmoji(false)
    const cursor = from + replacement.length
    requestAnimationFrame(() => {
      editor.current?.focus()
      editor.current?.setSelectionRange(cursor, cursor)
      selection.current = { start: cursor, end: cursor }
    })
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button type="button" size="icon" aria-label="개인 메모 열기" title="개인 메모" className="personal-note-button fixed bottom-[max(24px,env(safe-area-inset-bottom))] left-6 z-40 size-14 rounded-full border border-white/25 bg-gradient-to-br from-[#527b65] to-[#264c38] p-0 text-white shadow-[0_6px_20px_#264c3833] ring-4 ring-white/70 transition duration-200 hover:-translate-y-1 hover:shadow-[0_10px_24px_#264c3840] motion-reduce:transform-none [&_svg]:size-6"><StickyNote strokeWidth={1.7} /></Button></DialogTrigger>
    <DialogContent ref={panel} style={position ? { left: position.x, top: position.y, bottom: 'auto' } : undefined} overlayClassName="bg-black/[0.03] supports-backdrop-filter:backdrop-blur-none" className="left-4 top-auto bottom-[max(24px,env(safe-area-inset-bottom))] max-h-[calc(100dvh-32px)] translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-lg border border-[#dce4dc] p-0 shadow-xl ring-0 sm:left-6 sm:max-w-md">
      <DialogHeader className="relative border-b border-[#e1e7df] px-5 py-4 pr-12"><DialogTitle className="pointer-events-none font-display text-xl font-semibold">내 메모장</DialogTitle><DialogDescription className="sr-only">개인 메모. 상단을 드래그하거나 이동 버튼에서 방향키를 눌러 위치를 조정하세요.</DialogDescription><button type="button" aria-label="메모장 이동, 드래그하거나 방향키로 이동" title="드래그하여 이동" className="absolute inset-0 right-11 flex touch-none select-none items-center justify-end pr-3 text-[#a1aaa4] outline-none hover:text-[#527b65] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#527b65] cursor-grab active:cursor-grabbing" onPointerDown={startDrag} onPointerMove={(event) => { if (drag.current) movePanel(event.clientX - drag.current.x, event.clientY - drag.current.y) }} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }} onKeyDown={moveWithKeys}><GripHorizontal className="size-4" /></button></DialogHeader>
      {note.isError ? <div role="alert" className="rounded-xl bg-[#fff2ee] p-4 text-sm text-[#a95848]">메모를 불러오지 못했어요.<Button type="button" variant="outline" className="mt-3 block" onClick={() => note.refetch()}>다시 불러오기</Button></div> : <>
        <div className="overflow-hidden bg-white">
          <div className="flex items-center gap-1 border-b border-[#edf0eb] px-3 py-1 text-[#758078]" role="toolbar" aria-label="메모 편집 도구">
            <Button type="button" variant="ghost" size="icon" title="이모지 넣기" aria-label="이모지 넣기" aria-expanded={showEmoji} disabled={disabled} onClick={() => setShowEmoji(!showEmoji)}><Smile /></Button>
            <Button type="button" variant="ghost" size="icon" title="체크박스" aria-label="체크박스 넣기" disabled={disabled} onClick={() => insert('☐ ', true)}><CheckSquare /></Button>
          </div>
          {showEmoji && <div className="grid grid-cols-8 gap-1 border-b border-[#e1e7df] p-2" aria-label="이모지 선택">{emojis.map((emoji) => <button key={emoji} type="button" disabled={disabled} aria-label={`${emoji} 넣기`} className="rounded-lg p-2 text-xl hover:bg-[#f0f5ef] focus-visible:outline-2 focus-visible:outline-[#527b65]" onClick={() => insert(emoji)}>{emoji}</button>)}</div>}
          <textarea ref={editor} aria-label="개인 메모 내용" className="block h-[min(320px,40dvh)] w-full resize-none bg-transparent px-5 py-4 text-sm leading-7 outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#dce4dc] disabled:opacity-60" maxLength={10000} disabled={disabled} value={value} onChange={(event) => updateDraft(event.target.value)} onSelect={(event) => { selection.current = { start: event.target.selectionStart, end: event.target.selectionEnd } }} />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[#edf0eb] px-5 py-3"><p role="status" className="text-xs text-[#879189]">{note.isPending ? '불러오는 중...' : saving ? '저장 중...' : saveError ? '자동 저장 실패' : dirty ? '저장 대기 중...' : '자동 저장됨'}</p><span className="ml-auto text-xs tabular-nums text-[#a1aaa4]">{value.length.toLocaleString()} / 10,000</span>{saveError && <Button type="button" variant="outline" disabled={disabled} onClick={() => mutate(value)}>다시 저장</Button>}</div>
      </>}
    </DialogContent>
  </Dialog>
}
