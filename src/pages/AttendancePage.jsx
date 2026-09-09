import { useState } from 'react'
import TeacherScope from '../components/TeacherScope'
import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, ChevronRight, ClipboardPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function AttendancePage() {
  const { user } = useAuth()
  const [showAll, setShowAll] = useState(false)
  const sheets = useQuery({
    queryKey: ['attendance-sheets', user?.id, showAll],
    enabled: Boolean(user),
    queryFn: async () => {
      const result = []
      for (let offset = 0; ; offset += 500) {
        let request = supabase.from('attendance_sheets').select('id,attendance_date,classes!inner(id,teacher_id,name,start_time,end_time),attendance_records(status)').order('attendance_date', { ascending: false }).order('id').range(offset, offset + 499)
        if (!showAll) request = request.eq('classes.teacher_id', user.id)
        const { data, error } = await request
        if (error) throw error
        result.push(...data)
        if (data.length < 500) return result
      }
    },
  })
  return <div><main>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-4"><h1 className="dashboard-page-title inline-page-title">출석 리스트</h1><div className="ml-auto"><TeacherScope all={showAll} onChange={setShowAll} /></div><Button asChild className="h-11 bg-[#305c45] text-white hover:bg-[#264c38]"><Link to="/attendance/new"><ClipboardPlus />출석부 작성하기</Link></Button></div>
    <section className="overflow-hidden rounded-xl border border-[#e1e7df] bg-white">
      {sheets.isLoading ? <p className="p-14 text-center text-sm text-[#879189]">출석부를 불러오는 중...</p> : sheets.isError ? <div role="alert" className="p-12 text-center"><p>출석부를 불러오지 못했어요.</p><Button className="mt-4" variant="outline" onClick={() => sheets.refetch()}>다시 불러오기</Button></div> : !sheets.data?.length ? <div className="p-16 text-center"><CalendarCheck className="mx-auto mb-4 h-10 w-10 text-[#b3c0b6]" /><p className="font-semibold">작성한 출석부가 없어요.</p><p className="mt-2 text-sm text-[#879189]">수업과 날짜를 선택해 첫 출석부를 작성해 보세요.</p></div> : <div className="overflow-x-auto"><div className="min-w-[600px]"><div className="grid grid-cols-[1fr_1.4fr_1fr_24px] gap-4 border-b border-[#edf0eb] bg-[#fafbf9] px-6 py-3 text-xs font-semibold text-[#879189]"><span>수업 날짜</span><span>수업</span><span>출석 현황</span><span /></div>{sheets.data.map((sheet) => {
        const present = sheet.attendance_records.filter((record) => record.status === 'present').length
        const absent = sheet.attendance_records.filter((record) => record.status === 'absent').length
        return <Link className="grid grid-cols-[1fr_1.4fr_1fr_24px] items-center gap-4 border-b border-[#edf0eb] px-6 py-5 text-sm transition last:border-0 hover:bg-[#f7faf8]" key={sheet.id} to={'/attendance/new?classId=' + sheet.classes.id + '&date=' + sheet.attendance_date}><span className="font-medium">{sheet.attendance_date.replaceAll('-', '.')}</span><div className="min-w-0"><strong className="block truncate">{sheet.classes.name}</strong><span className="mt-1 block text-xs text-[#879189]">{sheet.classes.start_time.slice(0, 5)} – {sheet.classes.end_time.slice(0, 5)}</span></div><div className="flex gap-3 text-xs"><span className="text-[#527b65]">출석 {present}명</span><span className="text-[#a95848]">결석 {absent}명</span></div><ChevronRight className="h-4 w-4 text-[#9aa49d]" /></Link>
      })}</div></div>}
    </section>
  </main></div>
}
