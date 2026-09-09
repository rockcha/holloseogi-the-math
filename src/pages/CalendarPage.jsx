import { useQuery } from '@tanstack/react-query'
import MonthCalendar from '../components/MonthCalendar'
import { Button } from '../components/ui/button'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function CalendarPage() {
  const { user } = useAuth()
  const profile = useQuery({
    queryKey: ['teacher-profile', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('is_teacher').eq('id', user.id).single()
      if (error) throw error
      return data
    },
  })
  const classes = useQuery({
    queryKey: ['calendar-classes', user?.id],
    enabled: Boolean(user && profile.data?.is_teacher),
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('id,teacher_id,name,weekdays,start_time,end_time').eq('teacher_id', user.id).order('start_time')
      if (error) throw error
      return data
    },
  })
  return <main className="mx-auto w-[min(1180px,calc(100%-32px))] py-10">
    {profile.isError && <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-[#fff2ee] p-4 text-sm text-[#9a4936]">교사 정보를 확인하지 못했어요.<Button variant="outline" onClick={() => profile.refetch()}>다시 불러오기</Button></div>}
    {!profile.isPending && !profile.isError && !profile.data?.is_teacher && <p className="mb-4 rounded-lg bg-[#fff7df] p-4 text-sm text-[#795f1c]">교사로 승인된 계정만 일정을 관리할 수 있어요.</p>}
    {classes.isError && <Button className="mb-4" variant="outline" onClick={() => classes.refetch()}>수업 다시 불러오기</Button>}
    <MonthCalendar userId={user?.id} classes={classes.data || []} enabled={Boolean(profile.data?.is_teacher)} classesLoading={classes.isLoading || profile.isLoading} classesError={classes.isError} />
  </main>
}
