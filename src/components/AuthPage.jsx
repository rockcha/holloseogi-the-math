import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { getAuthErrorMessage, signIn, signUp } from '../lib/auth'
import { useAuth } from '../hooks/useAuth'
import BrandLogo from './BrandLogo'

const fieldClass = 'w-full rounded-2xl border border-[#dfe6dc] bg-white px-4 py-3.5 text-[15px] outline-none transition placeholder:text-[#a8b0ab] focus:border-[#527b65] focus:ring-3 focus:ring-[#527b65]/10'
const caption = '학생, 수업, 출석, 결제 시스템'

function TypingCaption() {
  const [length, setLength] = useState(0)

  useEffect(() => {
    let count = 0
    let timer
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    function typeNext() {
      count = count === caption.length ? 0 : count + 1
      setLength(count)
      timer = window.setTimeout(typeNext, count === caption.length ? 2500 : count === 0 ? 900 : 240)
    }
    function syncMotion() {
      window.clearTimeout(timer)
      if (!motion.matches) timer = window.setTimeout(typeNext, 900)
    }
    syncMotion()
    motion.addEventListener('change', syncMotion)
    return () => {
      window.clearTimeout(timer)
      motion.removeEventListener('change', syncMotion)
    }
  }, [])

  return <>
    <span className="sr-only motion-reduce:not-sr-only">{caption}</span>
    <span aria-hidden="true" className="inline-grid text-left motion-reduce:hidden">
      <span className="invisible col-start-1 row-start-1">{caption}</span>
      <span className="col-start-1 row-start-1 whitespace-pre-wrap">{caption.slice(0, length)}<span className="auth-typing-cursor ml-0.5 inline-block h-[1em] w-px translate-y-0.5 bg-current" /></span>
    </span>
  </>
}

export default function AuthPage() {
  const { pathname } = useLocation()
  const isSignup = pathname === '/signup'
  const navigate = useNavigate()
  const { user, isLoading } = useAuth()
  const [form, setForm] = useState({ email: '', password: '', passwordConfirm: '', nickname: '' })

  const mutation = useMutation({
    mutationFn: isSignup ? signUp : signIn,
    onSuccess: (data) => {
      if (isSignup && !data.session) {
        toast.success('가입 확인 메일을 보냈어요.', {
          description: '이메일 인증 후 로그인해 주세요.',
        })
        navigate('/login', { replace: true })
        return
      }
      toast.success(isSignup ? '회원가입이 완료됐어요.' : '로그인했어요.')
      navigate('/', { replace: true })
    },
    onError: (error) => toast.error(getAuthErrorMessage(error)),
  })

  if (!isLoading && user) return <Navigate to="/" replace />

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    mutation.reset()
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (isSignup && form.password !== form.passwordConfirm) {
      toast.error('비밀번호가 서로 일치하지 않습니다.')
      return
    }
    mutation.mutate(form)
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#305c45] p-14 text-white lg:flex lg:items-center lg:justify-center">
        <div className="relative z-10 w-full max-w-lg text-center">
          <h1 className="auth-brand-reveal"><BrandLogo className="flex-col gap-6" imageClassName="h-28 w-28" light textClassName="text-4xl leading-tight tracking-[-0.03em]" /></h1>
          <div className="auth-divider-reveal mx-auto mt-8 h-px w-10 bg-white/25" />
          <p className="auth-caption-reveal mt-6 text-lg font-medium tracking-wide text-[#c7ddcf]"><TypingCaption /></p>
        </div>
        <div aria-hidden="true" className="auth-background-drift pointer-events-none absolute -right-28 -bottom-36 h-120 w-120 rounded-full border-[80px] border-white/5" />
        <p className="absolute inset-x-0 bottom-10 text-center text-xs text-white/40">© 2026 홀로서기 더매쓰</p>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-[#fbfcf9] px-6 py-12">
        <div className="w-full max-w-105">
          <div className="mb-12 text-center lg:hidden">
            <BrandLogo className="auth-brand-reveal flex-col gap-4" imageClassName="h-20 w-20" textClassName="text-2xl" />
            <p className="auth-caption-reveal mt-4 text-sm text-[#527b65]"><TypingCaption /></p>
          </div>
          <div className="mb-9">
            <h2 className="font-display text-4xl font-bold tracking-[-0.04em] text-[#24342d]">{isSignup ? '회원가입' : '로그인'}</h2>
            {isSignup && <p className="mt-3 text-sm text-[#7a857f]">수업 관리에 사용할 계정을 만들어 주세요.</p>}
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {isSignup && (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">닉네임</span>
                <input className={fieldClass} name="nickname" onChange={updateField} placeholder="사용할 닉네임" required value={form.nickname} />
              </label>
            )}
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">이메일</span>
              <input autoComplete="email" className={fieldClass} name="email" onChange={updateField} placeholder="name@example.com" required type="email" value={form.email} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">비밀번호</span>
              <input autoComplete={isSignup ? 'new-password' : 'current-password'} className={fieldClass} minLength={6} name="password" onChange={updateField} placeholder={isSignup ? '6자 이상 입력해 주세요' : '비밀번호를 입력해 주세요'} required type="password" value={form.password} />
            </label>
            {isSignup && (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">비밀번호 확인</span>
                <input autoComplete="new-password" className={fieldClass} minLength={6} name="passwordConfirm" onChange={updateField} placeholder="비밀번호를 다시 입력해 주세요" required type="password" value={form.passwordConfirm} />
              </label>
            )}

            <button className="mt-2 w-full cursor-pointer rounded-2xl bg-[#305c45] py-4 font-bold text-white transition hover:bg-[#264c38] disabled:cursor-not-allowed disabled:opacity-60" disabled={mutation.isPending} type="submit">
              {mutation.isPending ? '처리 중...' : isSignup ? '회원가입하기' : '로그인하기'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-[#7a857f]">
            {isSignup ? '이미 계정이 있나요?' : '아직 계정이 없나요?'}{' '}
            <Link className="font-bold text-[#305c45] underline decoration-[#a9c0b1] underline-offset-4" to={isSignup ? '/login' : '/signup'}>
              {isSignup ? '로그인' : '회원가입'}
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}
