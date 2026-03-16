import { Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useAuth } from './contexts/AuthContext'
import { AttendanceProvider } from './contexts/AttendanceContext'
import Layout from './layouts/Layout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Workers from './pages/Workers'
import WorkTypes from './pages/WorkTypes'
import Fabrics from './pages/Fabrics'
import Attendance from './pages/Attendance'
import AttendanceHistory from './pages/AttendanceHistory'
import DailyUsage from './pages/DailyUsage'
import Assignments from './pages/Assignments'
import Waste from './pages/Waste'
import WeeklyWages from './pages/WeeklyWages'
import Reports from './pages/Reports'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-navy-950"><div className="animate-spin w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full" /></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <AnimatePresence mode="wait">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<ProtectedRoute><AttendanceProvider><Layout /></AttendanceProvider></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="workers" element={<Workers />} />
          <Route path="work-types" element={<WorkTypes />} />
          <Route path="fabrics" element={<Fabrics />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="attendance-history" element={<AttendanceHistory />} />
          <Route path="daily-usage" element={<DailyUsage />} />
          <Route path="assignments" element={<Assignments />} />
          <Route path="waste" element={<Waste />} />
          <Route path="weekly-wages" element={<WeeklyWages />} />
          <Route path="reports" element={<Reports />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}
