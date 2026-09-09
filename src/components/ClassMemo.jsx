/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { StickyNote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { supabase } from '../lib/supabase'

export default function ClassMemo({ classId }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(null)
  const memo = useQuery({
    queryKey: ['class-memo', classId],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('memo').eq('id', classId).single()
      if (error) throw error
      return data.memo || ''
    },
  })
  const save = useMutation({
    mutationFn: async (value) => {
      const { data, error } = await supabase.from('classes').update({ memo: value || null }).eq('id', classId).select('memo').single()
      if (error) throw error
      return data.memo || ''
    },
    onSuccess: async (value) => {
      queryClient.setQueryData(['class-memo', classId], value)
      setDraft((latest) => latest === value ? null : latest)
      await queryClient.invalidateQueries({ queryKey: ['classes'] })
    },
  })
  const value = draft ?? memo.data ?? ''
  const dirty = draft !== null && draft !== (memo.data ?? '')
  const { mutate, isPending: saving, isError: saveError } = save
  useEffect(() => {
    if (!dirty || memo.isPending || memo.isError || saving || saveError) return
    const timer = setTimeout(() => mutate(draft), 700)
    return () => clearTimeout(timer)
  }, [draft, dirty, memo.isPending, memo.isError, saving, saveError, mutate])

  return <section className="mt-6 rounded-xl border border-[#e1e7df] bg-white p-6 sm:p-7">
    <div className="mb-4 flex items-center justify-between gap-3"><Label htmlFor="class-memo" className="flex items-center gap-2 text-base font-semibold"><StickyNote className="h-4 w-4 text-[#527b65]" />수업 메모</Label><span role="status" className="text-xs text-[#879189]">{memo.isPending ? '불러오는 중...' : memo.isError ? '' : saving ? '저장 중...' : saveError ? '자동 저장 실패' : dirty ? '저장 대기 중...' : '자동 저장됨'}</span></div>
    {saveError && <div role="alert" className="mb-3 text-sm text-[#a95848]">메모를 저장하지 못했어요. 작성한 내용은 유지됩니다.<Button type="button" className="ml-3" variant="outline" onClick={() => mutate(value)}>다시 저장</Button></div>}
    {memo.isError ? <div role="alert" className="text-sm text-[#a95848]">메모를 불러오지 못했어요.<Button className="ml-3" variant="outline" onClick={() => memo.refetch()}>다시 불러오기</Button></div> : <><textarea id="class-memo" rows={5} maxLength={5000} disabled={memo.isPending} value={value} onChange={(event) => { if (save.isError) save.reset(); setDraft(event.target.value) }} onBlur={() => { if (dirty && !saving && !saveError) mutate(value) }} placeholder={memo.isLoading ? '메모를 불러오는 중...' : '수업 진도, 준비할 내용, 참고 사항을 기록해 주세요.'} className="w-full resize-y rounded-lg border border-[#dce4dc] bg-white p-3 text-sm leading-6 outline-none focus:border-[#527b65] focus:ring-2 focus:ring-[#527b65]/10 disabled:opacity-60" /><p className="mt-2 text-right text-xs text-[#879189]">{value.length.toLocaleString()} / 5,000</p></>}
  </section>
}
