import DashboardLayout from './components/DashboardLayout'
import { Navigate, Route, Routes } from 'react-router-dom'
import AuthPage from './components/AuthPage'
import ClassesPage from './pages/ClassesPage'
import ClassDetailPage from './pages/ClassDetailPage'
import HomePage from './pages/HomePage'
import CalendarPage from './pages/CalendarPage'
import StudentsPage from './pages/StudentsPage'
import AttendancePage from './pages/AttendancePage'
import AttendanceFormPage from './pages/AttendanceFormPage'

import PaymentsPage from './pages/PaymentsPage'

export default function App() {
  return <Routes>
    <Route element={<DashboardLayout />}><Route path="/" element={<HomePage />} />
    <Route path="/calendar" element={<CalendarPage />} />
    <Route path="/students" element={<StudentsPage />} />
    <Route path="/classes" element={<ClassesPage />} />
    <Route path="/classes/:classId" element={<ClassDetailPage />} />
    <Route path="/attendance" element={<AttendancePage />} />
    <Route path="/attendance/new" element={<AttendanceFormPage />} />
    <Route path="/payments" element={<PaymentsPage />} />
    <Route path="/payments/students" element={<Navigate to="/payments/classes" replace />} />
    <Route path="/payments/classes" element={<PaymentsPage />} />
    <Route path="/payments/history" element={<PaymentsPage />} />
    <Route path="/payments/classes/:classId" element={<PaymentsPage />} />
    </Route><Route path="/login" element={<AuthPage />} />
    <Route path="/signup" element={<AuthPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
