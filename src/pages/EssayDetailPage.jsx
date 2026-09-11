import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Clock3, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import EssayDialog from '../components/EssayDialog'
import EssayTrackBadge from '../components/EssayTrackBadge'
import { useEssayAccess, useEssays } from '../hooks/useEssays'
import { supabase } from '../lib/supabase'
import { essayDday } from '../lib/essays'

export default function EssayDetailPage() {
  const { essayId } = useParams()
  const { user, profile, enabled } = useEssayAccess()
  const result = useEssays(user?.id, enabled, essayId)
  const client = useQueryClient()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const remove = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('essays').delete().eq('id', essayId).select('id').single()
      if (error) throw error
      return data
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['essays'] })
      toast.success('논술 일정을 삭제했어요.')
      navigate('/essays', { replace: true })
    },
    onError: () => toast.error('삭제하지 못했어요. 다시 시도해 주세요.'),
  })
  const essay = result.data
  return <div className="essay-page"><main>
    {(profile.isLoading || (enabled && result.isLoading)) && <p role="status">논술 정보를 불러오는 중...</p>}
    {(profile.isError || result.isError) && <div role="alert" className="bg-[#fff2ee] p-4 text-sm text-[#9a4936]">논술 정보를 불러오지 못했어요. <Button variant="outline" onClick={() => profile.isError ? profile.refetch() : result.refetch()}>다시 시도</Button></div>}
    {profile.isSuccess && !enabled && <p>교사로 승인된 계정만 논술 정보를 확인할 수 있어요.</p>}
    {enabled && result.isSuccess && !essay && <p>학교를 찾을 수 없거나 접근 권한이 없어요.</p>}
    {enabled && essay && <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><h1 className="dashboard-page-title inline-page-title min-w-0 break-words">{essay.university_name}</h1><div className="flex gap-2"><Button variant="outline" onClick={() => setEditing(true)}><Pencil size={15} />수정</Button><Button variant="outline" className="text-[#a95848]" onClick={() => { remove.reset(); setDeleting(true) }}><Trash2 size={15} />삭제</Button></div></div>
      <section className="essay-panel border border-[#e1e7df] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-1.5"><span className={`px-2 py-1 text-xs font-normal ${essay.essay_type === '약술' ? 'essay-short' : 'essay-humanities'}`}>{essay.essay_type}</span><EssayTrackBadge track={essay.track} /></div>
            <h2 className="break-words text-base font-semibold">{essay.schedule_name || `${essay.track}계열`}</h2>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#65736b]">
              <span className="inline-flex items-center gap-2"><CalendarDays size={16} strokeWidth={1.7} aria-hidden="true" /><span className="sr-only">시험 날짜 </span><time dateTime={essay.exam_date} className="tabular-nums">{essay.exam_date.replaceAll('-', '. ')}</time></span>
              <span className="inline-flex items-center gap-2"><Clock3 size={16} strokeWidth={1.7} aria-hidden="true" /><span className="sr-only">시험 시간 </span>{essay.exam_time || '시간 미확정'}</span>
            </div>
          </div>
          <span className="shrink-0 bg-[#eaf2ed] px-3 py-2 text-sm font-medium tabular-nums text-[#305c45]">{essayDday(essay.exam_date)}</span>
        </div>
        <div className="mt-6 border-t border-[#edf0eb] pt-5"><h2 className="text-sm font-semibold">특징 메모</h2><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[#65736b]">{essay.memo || '등록된 특징 메모가 없어요.'}</p></div>
      </section>
      <section className="essay-panel mt-5 border border-[#e1e7df] bg-white"><div className="flex items-center justify-between border-b border-[#edf0eb] p-5"><h2 className="text-sm font-semibold">학생 목록 · {essay.essay_students.length}명</h2><Button variant="outline" size="sm" onClick={() => setEditing(true)}>학생 추가·수정</Button></div>{essay.essay_students.length ? <ul className="divide-y divide-[#edf0eb]">{essay.essay_students.map(({ student_id, students }) => <li key={student_id} className="flex items-center justify-between gap-3 px-5 py-4 text-sm"><strong>{students?.name || '학생 정보 확인 불가'}</strong><span className="text-[#758078]">{students?.phone || '연락처 미등록'}</span></li>)}</ul> : <p className="p-10 text-center text-sm text-[#758078]">아직 추가된 학생이 없어요. 학생 추가·수정에서 선택해 주세요.</p>}</section>
      {editing && <EssayDialog essay={essay} userId={user.id} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
      <Dialog open={deleting} onOpenChange={(open) => { if (!remove.isPending) setDeleting(open) }}><DialogContent className="essay-dialog rounded-none p-6 sm:max-w-sm"><DialogHeader><DialogTitle>논술 일정을 삭제할까요?</DialogTitle><DialogDescription>{essay.university_name} · {essay.essay_type} · {essay.track} 계열 · {essay.schedule_name || `${essay.track}계열`} ({essay.exam_date} · {essay.exam_time || '시간 미확정'}) 시험과 해당 학생 배정이 삭제됩니다. 학생의 기본 정보는 유지되며, 삭제한 일정은 복구할 수 없어요.</DialogDescription></DialogHeader>{remove.isError && <p role="alert" className="text-sm text-[#a95848]">삭제하지 못했어요. 연결 상태와 권한을 확인해 주세요.</p>}<DialogFooter><Button variant="outline" disabled={remove.isPending} onClick={() => setDeleting(false)}>취소</Button><Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>{remove.isPending ? '삭제 중...' : '삭제 확인'}</Button></DialogFooter></DialogContent></Dialog>
    </>}
  </main></div>
}
