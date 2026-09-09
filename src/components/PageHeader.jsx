import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../lib/auth'
import BrandLogo from './BrandLogo'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export default function PageHeader() {
  const { user, isLoading } = useAuth()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const logout = useMutation({ mutationFn: signOut, onSuccess: () => setLogoutOpen(false), onError: () => toast.error('로그아웃하지 못했어요.') })
  const nickname = user?.user_metadata?.nickname

  return <>
    <header className="sticky top-0 z-40 border-b border-[#e1e7df] bg-white">
      <div className="mx-auto flex h-20 w-[min(1080px,calc(100%-32px))] items-center justify-between">
        <BrandLogo imageClassName="h-13 w-13" textClassName="text-2xl" />
        {!isLoading && <div className="text-sm font-semibold">{user ? <button className="px-4 py-2 text-[#52635a] transition hover:bg-[#f1f5f0] hover:text-[#305c45] disabled:opacity-50" disabled={logout.isPending} onClick={() => setLogoutOpen(true)} title="로그아웃" type="button">{logout.isPending ? '로그아웃 중...' : nickname || user.email}</button> : <Link className="rounded-sm bg-[#305c45] px-5 py-2.5 text-white transition hover:bg-[#264c38]" to="/login">로그인</Link>}</div>}
      </div>
    </header>
    <Dialog open={logoutOpen} onOpenChange={(open) => { if (!logout.isPending) setLogoutOpen(open) }}>
      <DialogContent className="rounded-2xl p-6" showCloseButton={false}>
        <DialogHeader><DialogTitle className="font-display text-xl font-bold text-[#24342d]">로그아웃하시겠습니까?</DialogTitle><DialogDescription>현재 계정에서 안전하게 로그아웃합니다.</DialogDescription></DialogHeader>
        <DialogFooter className="mx-0 mb-0 mt-3 rounded-none border-0 bg-transparent p-0"><Button disabled={logout.isPending} onClick={() => setLogoutOpen(false)} type="button" variant="outline">취소</Button><Button className="bg-[#305c45] text-white hover:bg-[#264c38]" disabled={logout.isPending} onClick={() => logout.mutate()} type="button">{logout.isPending ? '로그아웃 중...' : '로그아웃'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
