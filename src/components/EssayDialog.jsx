/* eslint-disable react/prop-types */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import EssayTrackBadge from './EssayTrackBadge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { supabase } from '../lib/supabase'
import { ESSAY_TRACKS, essayError, essayForm, essayPayload, essaySaveError } from '../lib/essays'

export default function EssayDialog({ essay, userId, onClose, onSaved }) {
  const client = useQueryClient()
  const [form, setForm] = useState(() => essayForm(essay))
  const [selected, setSelected] = useState(() => (essay?.essay_students || []).map((item) => item.student_id))
  const [search, setSearch] = useState('')
  const students = useQuery({
    queryKey: ['essay-student-options', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('students').select('id,name,phone').order('name')
      if (error) throw error
      return data
    },
  })
  const validation = essayError(form)
  const save = useMutation({
    mutationFn: async () => {
      if (validation) throw new Error(validation)
      const { data, error } = await supabase.rpc('save_essay', essayPayload(form, essay?.id, selected))
      if (error) throw error
      return data
    },
    onSuccess: async (id) => {
      await client.invalidateQueries({ queryKey: ['essays'] })
      toast.success(essay ? '논술 정보를 수정했어요.' : '학교를 추가했어요.')
      onSaved(id)
    },
    onError: (error) => toast.error(essaySaveError(error)),
  })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <Dialog open onOpenChange={(open) => { if (!open && !save.isPending) onClose() }}>
    <DialogContent className="essay-dialog max-h-[calc(100dvh-32px)] overflow-y-auto rounded-none p-6 sm:max-w-xl">
      <DialogHeader><DialogTitle className="font-display text-2xl">{essay ? '논술 정보 수정' : '학교 추가'}</DialogTitle><DialogDescription>같은 대학도 계열·시험별로 각각 등록하세요. 모든 교사가 함께 사용하며, 학생은 선택하지 않아도 저장할 수 있어요.</DialogDescription></DialogHeader>
      <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); if (!save.isPending && !validation) save.mutate() }}>
        <fieldset disabled={save.isPending} className="space-y-5">
          <div className="space-y-2"><Label htmlFor="essay-name">대학교 이름 *</Label><Input autoFocus id="essay-name" required maxLength={100} placeholder="대학교 이름을 입력하세요" value={form.university_name} onChange={(e) => update('university_name', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="essay-type">논술 유형 *</Label><select id="essay-type" className="h-10 w-full px-3 text-sm" value={form.essay_type} onChange={(e) => setForm((current) => ({ ...current, essay_type: e.target.value, track: ESSAY_TRACKS[e.target.value].includes(current.track) ? current.track : '인문' }))}>{Object.keys(ESSAY_TRACKS).map((type) => <option key={type}>{type}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="essay-track">계열 *</Label><select id="essay-track" className="h-10 w-full px-3 text-sm" value={form.track} onChange={(e) => update('track', e.target.value)}>{ESSAY_TRACKS[form.essay_type].map((track) => <option key={track}>{track}</option>)}</select></div>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#758078]">선택한 계열 <EssayTrackBadge track={form.track} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="essay-date">시험 날짜 *</Label><Input id="essay-date" type="date" required value={form.exam_date} onChange={(e) => update('exam_date', e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="essay-time">시험 시간</Label><Input id="essay-time" placeholder="예: 09:00 / 오전" value={form.exam_time} onChange={(e) => update('exam_time', e.target.value)} /><p className="text-xs text-[#758078]">미확정이면 비워 두세요.</p></div>
          </div>
          <div className="space-y-2"><Label htmlFor="essay-memo">특징 메모</Label><textarea id="essay-memo" className="w-full border border-[#dce4dc] p-3 text-sm leading-6" rows={4} maxLength={5000} placeholder="출제 특징, 준비 사항 등을 기록하세요" value={form.memo} onChange={(e) => update('memo', e.target.value)} /><p className="text-right text-xs text-[#879189]">{form.memo.length.toLocaleString()} / 5,000</p></div>
          <div className="space-y-2"><Label htmlFor="essay-student-search">학생 추가 · {selected.length}명 선택</Label><p className="text-xs text-[#758078]">등록된 학생을 선택하세요. 학생은 나중에도 추가하거나 제외할 수 있어요.</p><Input id="essay-student-search" type="search" placeholder="학생 이름 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
            {students.isLoading ? <p role="status" className="text-sm">학생 목록을 불러오는 중...</p> : students.isError ? <div role="alert" className="text-sm text-[#a95848]">학생 목록을 불러오지 못했어요. <Button type="button" variant="outline" size="sm" onClick={() => students.refetch()}>다시 시도</Button></div> : <div className="max-h-44 overflow-y-auto border border-[#e1e7df]">
              {students.data?.filter((student) => student.name.includes(search.trim())).map((student) => <label key={student.id} className="flex items-center gap-3 border-b border-[#edf0eb] px-3 py-3 text-sm last:border-0 hover:bg-[#f4f8f5]"><input type="checkbox" className="size-4 accent-[#305c45]" checked={selected.includes(student.id)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id))} /><span>{student.name}</span><span className="ml-auto text-xs text-[#879189]">{student.phone || '연락처 미등록'}</span></label>)}
              {!students.data?.some((student) => student.name.includes(search.trim())) && <p className="p-4 text-sm text-[#758078]">{students.data?.length ? '검색 결과가 없어요.' : '등록된 학생이 없어요. 학생 메뉴에서 먼저 등록해 주세요.'}</p>}
            </div>}
          </div>
        </fieldset>
        {validation && <p className="text-xs text-[#758078]">{validation}</p>}
        {save.isError && <p role="alert" className="text-sm text-[#a95848]">{essaySaveError(save.error)}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>취소</Button><Button type="submit" className="bg-[#305c45] text-white hover:bg-[#264c38]" disabled={Boolean(validation) || save.isPending || students.isLoading || students.isError}>{save.isPending ? '저장 중...' : '저장'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
