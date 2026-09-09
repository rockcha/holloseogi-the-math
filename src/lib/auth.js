import { supabase } from './supabase'

export async function signUp({ email, password, nickname }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nickname } },
  })
  if (error) throw error

  if (data.session && data.user) {
    const { error: profileError } = await supabase
      .from('users')
      .upsert({ id: data.user.id, nickname }, { onConflict: 'id' })
    if (profileError) throw profileError
  }
  return data
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error

  const nickname = data.user?.user_metadata?.nickname
  if (nickname) {
    const { error: profileError } = await supabase
      .from('users')
      .upsert({ id: data.user.id, nickname }, { onConflict: 'id', ignoreDuplicates: true })
    if (profileError) throw profileError
  }
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function getAuthErrorMessage(error) {
  const messages = {
    'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'Email not confirmed': '이메일 인증을 먼저 완료해 주세요.',
    'User already registered': '이미 가입된 이메일입니다.',
    'Password should be at least 6 characters': '비밀번호는 6자 이상이어야 합니다.',
    'Unable to validate email address: invalid format': '올바른 이메일 주소를 입력해 주세요.',
  }
  return messages[error?.message] ?? error?.message ?? '잠시 후 다시 시도해 주세요.'
}
