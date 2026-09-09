import { Phone } from 'lucide-react'

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[#e1e7df] bg-white/60">
      <div className="mx-auto flex w-[min(1080px,calc(100%-32px))] flex-col gap-3 py-6 text-sm text-[#748078] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <strong className="font-display text-base text-[#305c45]">홀로서기 더매쓰</strong>
          <p className="mt-1 text-xs text-[#929b95]">학생과 수업을 위한 교육 관리 서비스</p>
        </div>
        <a className="inline-flex items-center gap-2 font-semibold transition hover:text-[#305c45]" href="tel:010-5521-1476">
          <Phone className="h-4 w-4" />
          <span className="text-xs font-medium text-[#929b95]">문의</span>
          010-5521-1476
        </a>
      </div>
    </footer>
  )
}
