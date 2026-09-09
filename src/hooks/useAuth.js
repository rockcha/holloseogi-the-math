import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const sessionQueryKey = ['auth', 'session']

export function useAuth() {
  const queryClient = useQueryClient()
  const sessionQuery = useQuery({
    queryKey: sessionQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      return data.session
    },
    staleTime: Infinity,
  })

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      queryClient.setQueryData(sessionQueryKey, session)
    })
    return () => subscription.unsubscribe()
  }, [queryClient])

  return {
    session: sessionQuery.data ?? null,
    user: sessionQuery.data?.user ?? null,
    isLoading: sessionQuery.isLoading,
  }
}
