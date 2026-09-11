import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

export function useEssayAccess() {
  const { user } = useAuth()
  const profile = useQuery({
    queryKey: ['teacher-profile', user?.id], enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('is_teacher').eq('id', user.id).single()
      if (error) throw error
      return data
    },
  })
  return { user, profile, enabled: Boolean(user && profile.data?.is_teacher) }
}

export function useEssays(userId, enabled, essayId) {
  return useQuery({
    // Shared records; keep the cache scoped to the signed-in account for RLS changes.
    queryKey: ['essays', userId, essayId || 'list'], enabled,
    queryFn: async () => {
      let request = supabase.from('essays').select('id,university_name,essay_type,track,schedule_name,exam_date,exam_time,department_group,question_format,subjects,minimum_requirement,memo,essay_students(student_id,students(id,name,phone))')
      request = essayId ? request.eq('id', essayId).maybeSingle() : request.order('exam_date').order('exam_time').order('university_name').order('track').order('schedule_name').order('id')
      const { data, error } = await request
      if (error) throw error
      return data
    },
  })
}
