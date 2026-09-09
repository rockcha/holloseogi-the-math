import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom'
import { CalendarDays, CalendarRange, Users, BookOpen, ClipboardCheck, CreditCard, ChevronRight } from 'lucide-react'
import PageHeader from './PageHeader'
import PersonalNote from './PersonalNote'
import { useAuth } from '../hooks/useAuth'

const menus = [
  { to: '/', label: '시간표', icon: CalendarDays },
  { to: '/calendar', label: '일정', icon: CalendarRange },
  { to: '/students', label: '학생', icon: Users, children: [['학생 리스트', '/students'], ['학생 추가', '/students?action=new']] },
  { to: '/classes', label: '수업', icon: BookOpen, children: [['수업 리스트', '/classes'], ['수업 추가하기', '/classes?action=new']] },
  { to: '/attendance', label: '출석', icon: ClipboardCheck, children: [['출석 리스트', '/attendance'], ['출석부 작성하기', '/attendance/new']] },
  { to: '/payments', label: '결제', icon: CreditCard, children: [['결제 리스트', '/payments'], ['수업별 납부 현황', '/payments/classes'], ['결제 내역 추가', '/payments?action=new']] },
]

const pageTitles = {
  '/students': '학생 리스트',
  '/payments/classes': '수업별 납부 현황',
}

export default function DashboardLayout() {
  const { user, isLoading } = useAuth()
  const { pathname, search } = useLocation()
  if (isLoading) return <div className="grid min-h-screen place-items-center text-sm text-[#758078]">불러오는 중...</div>
  if (!user) return <Navigate to="/login" replace />
  return <div className="dashboard-shell">
    <PageHeader />
    <PersonalNote key={user.id} userId={user.id} />
    <div className="dashboard-body">
      <aside className="dashboard-sidebar">
        <p className="sidebar-caption">워크스페이스</p>
        <nav aria-label="관리 메뉴">{menus.map(({ to, label, icon: Icon, children }) => {
          const active = to === '/' ? pathname === '/' : pathname.startsWith(to)
          return <div className="sidebar-group" key={to}>
            <NavLink to={to} end={to === '/'} className={`sidebar-link ${active ? 'is-active' : ''}`}><Icon size={20} strokeWidth={1.7} /><span>{label}</span>{children && <ChevronRight size={15} className={active ? 'rotate-90' : ''} />}</NavLink>
            {children && active && <div className="sidebar-submenu">{children.map(([text, href]) => <NavLink key={href} to={href} className={`sidebar-sublink ${pathname + search === href ? 'is-selected' : ''}`}>{text}</NavLink>)}</div>}
          </div>
        })}</nav>
      </aside>
      <div className="dashboard-content">{pageTitles[pathname] && <h1 className="dashboard-page-title">{pageTitles[pathname]}</h1>}<Outlet /></div>
    </div>
  </div>
}
