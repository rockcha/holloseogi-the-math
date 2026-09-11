import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '../components/ui/button'
import EssaySearch from '../components/EssaySearch'
import EssayDialog from '../components/EssayDialog'
import EssayTrackBadge from '../components/EssayTrackBadge'
import { useEssayAccess, useEssays } from '../hooks/useEssays'
import { dateKey, monthDays } from '../lib/calendar'
import { ESSAY_TRACKS, essayDday, filterEssays } from '../lib/essays'

export default function EssaysPage() {
  const { user, profile, enabled } = useEssayAccess()
  const essays = useEssays(user?.id, enabled)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isList = pathname === '/essays/list'
  const [params, setParams] = useSearchParams()
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [today, setToday] = useState(() => dateKey(new Date()))
  useEffect(() => { const timer = setInterval(() => setToday(dateKey(new Date())), 60000); return () => clearInterval(timer) }, [])
  const type = Object.hasOwn(ESSAY_TRACKS, params.get('type')) ? params.get('type') : ''
  const tracks = ESSAY_TRACKS[type] || ['인문', '사회', '자연']
  const track = tracks.includes(params.get('track')) ? params.get('track') : ''
  const search = isList ? params.get('q') || '' : ''
  const filtered = filterEssays(essays.data || [], type, search, track)
  const days = monthDays(month)
  function parameter(key, value) { setParams((current) => { const next = new URLSearchParams(current); if (value) next.set(key, value); else next.delete(key); return next }, { replace: true }) }
  function changeType(value) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set('type', value); else next.delete('type')
      if (value && !ESSAY_TRACKS[value].includes(next.get('track'))) next.delete('track')
      return next
    }, { replace: true })
  }
  return <div className="essay-page"><main>
    <div className="mb-6 flex flex-wrap justify-between gap-3"><div><h1 className="dashboard-page-title inline-page-title">{isList ? '대학 리스트' : '논술 일정'}</h1><p className="mt-2 text-sm text-[#758078]">{isList ? '등록된 대학의 논술 정보와 특징을 검색하고 확인하세요.' : '학교별 시험 일정과 남은 날짜를 한눈에 확인하세요.'}</p></div><Button className="h-11 bg-[#305c45] text-white hover:bg-[#264c38]" disabled={!enabled} onClick={() => parameter('action', 'new')}><Plus size={16} />학교 추가</Button></div>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="논술 유형 필터"><span className="w-12 text-xs font-semibold text-[#758078]">유형</span>{[['', '전체'], ['약술', '약술'], ['인문', '인문']].map(([value, label]) => <Button key={value} variant="outline" aria-pressed={type === value} className={type === value ? 'border-[#305c45] bg-[#eaf2ed] text-[#305c45]' : 'bg-white'} onClick={() => changeType(value)}>{label}</Button>)}</div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="논술 계열 필터"><span className="w-12 text-xs font-semibold text-[#758078]">계열</span>{['', ...tracks].map((value) => <Button key={value} variant="outline" aria-pressed={track === value} className={track === value ? 'border-[#305c45] bg-[#eaf2ed] text-[#305c45]' : 'bg-white'} onClick={() => parameter('track', value)}>{value ? `${value} 계열` : '전체 계열'}</Button>)}</div>
      </div>
      {isList && <div className="w-full sm:w-72"><EssaySearch value={search} onChange={(value) => parameter('q', value)} /></div>}
    </div>
    {profile.isLoading && <p role="status">권한을 확인하는 중...</p>}
    {profile.isError && <div role="alert">교사 정보를 확인하지 못했어요. <Button variant="outline" onClick={() => profile.refetch()}>다시 시도</Button></div>}
    {profile.isSuccess && !enabled && <p className="border border-[#ecdca9] bg-[#fff7df] p-4 text-sm">교사로 승인된 계정만 논술 일정을 관리할 수 있어요.</p>}
    {enabled && <>
      {essays.isLoading && <p role="status" className="mb-4 text-sm">논술 일정을 불러오는 중...</p>}
      {essays.isError && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 bg-[#fff2ee] p-4 text-sm text-[#9a4936]">논술 일정을 불러오지 못했어요.<Button variant="outline" onClick={() => essays.refetch()}>다시 불러오기</Button></div>}
      {!isList && <section className="essay-panel overflow-hidden border border-[#e1e7df] bg-white" aria-label="논술 월간 달력" aria-busy={essays.isLoading}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e1e7df] p-4"><div className="flex items-center gap-2"><Button variant="ghost" size="icon" aria-label="이전 달" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></Button><h2 aria-live="polite" className="min-w-32 text-center text-lg font-semibold">{month.getFullYear()}년 {month.getMonth() + 1}월</h2><Button variant="ghost" size="icon" aria-label="다음 달" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></Button><Button variant="outline" size="sm" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setToday(dateKey(now)) }}>오늘</Button></div><div className="flex gap-3 text-xs"><span className="essay-short px-2 py-1">약술</span><span className="essay-humanities px-2 py-1">인문</span></div></div>
        <div className="overflow-x-auto"><div className="min-w-[560px]"><div className="grid grid-cols-7 border-b border-[#e1e7df] bg-[#fafbf9]">{['월', '화', '수', '목', '금', '토', '일'].map((day) => <div key={day} className="py-3 text-center text-xs text-[#758078]">{day}</div>)}</div><div className="grid grid-cols-7">{days.map((date) => {
          const key = dateKey(date)
          return <div key={key} className={`min-h-32 min-w-0 border-b border-r border-[#edf0eb] p-2 ${date.getMonth() === month.getMonth() ? 'bg-white' : 'bg-[#f7f8f6]'}`}><span aria-current={key === today ? 'date' : undefined} className={`mb-2 inline-flex size-7 items-center justify-center text-xs ${key === today ? 'bg-[#305c45] font-bold text-white' : date.getDay() === 0 ? 'text-[#b66b5d]' : 'text-[#758078]'}`}>{date.getDate()}</span><div className="max-h-48 space-y-1 overflow-y-auto">{filtered.filter((item) => item.exam_date === key).map((item) => <Link key={item.id} to={`/essays/${item.id}`} title={`${item.university_name} · ${item.track} 계열 · ${essayDday(key, today)}`} className={`block p-1.5 text-xs ${item.essay_type === '약술' ? 'essay-short' : 'essay-humanities'}`}><strong className="block truncate">{item.university_name}</strong><span className="mt-1 flex flex-wrap items-center gap-1"><EssayTrackBadge track={item.track} compact /><span className="text-[10px]">{essayDday(key, today)}</span></span></Link>)}</div></div>
        })}</div></div></div>
      </section>}
      {isList && essays.isSuccess && <section className="essay-panel border border-[#e1e7df] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0eb] p-4"><h2 className="text-sm font-semibold">{search.trim() ? '검색 결과' : '전체 대학 일정'}</h2><span aria-live="polite" className="text-xs text-[#758078]">{filtered.length}건</span></div>
        {filtered.length ? <div className="divide-y divide-[#edf0eb]">{filtered.map((item) => <Link key={item.id} to={`/essays/${item.id}`} className="block px-4 py-4 text-sm hover:bg-[#f4f8f5]">
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
              <strong className="min-w-0 break-words leading-6">{item.university_name}</strong>
              <div className="flex shrink-0 items-center gap-1.5"><span className={`whitespace-nowrap px-2 py-1 text-xs font-normal ${item.essay_type === '약술' ? 'essay-short' : 'essay-humanities'}`}>{item.essay_type}</span><EssayTrackBadge track={item.track} /></div>
              <div className="flex shrink-0 items-center gap-3 text-xs"><span className="text-[#758078]">{item.exam_date.replaceAll('-', '.')}</span><span className="font-semibold text-[#305c45]">{essayDday(item.exam_date, today)}</span></div>
            </div>
            <span className="shrink-0 pt-1 text-right text-xs tabular-nums text-[#758078]">{item.essay_students.length}명</span>
          </div>
          <p className="mt-2 line-clamp-2 break-words text-xs leading-6 text-[#758078]">{item.memo || '등록된 특징 메모가 없어요.'}</p>
        </Link>)}</div> : <div className="p-10 text-center text-sm text-[#758078]"><p>{search.trim() || type || track ? '조건에 맞는 대학이 없어요.' : '등록된 대학이 없어요. 학교를 추가해 보세요.'}</p>{(search.trim() || type || track) && <Button variant="outline" className="mt-4" onClick={() => setParams({}, { replace: true })}>검색·필터 초기화</Button>}</div>}
      </section>}
    </>}
    {enabled && params.get('action') === 'new' && <EssayDialog userId={user.id} onClose={() => parameter('action', '')} onSaved={(id) => navigate(`/essays/${id}`)} />}
  </main></div>
}
