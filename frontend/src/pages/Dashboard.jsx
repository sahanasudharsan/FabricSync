import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, Package, CalendarCheck, Trash2, Wallet, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { reportAPI, assignmentAPI, wasteAPI, workerAPI, dailyUsageAPI } from '../services/api'
import { useAttendance } from '../contexts/AttendanceContext'

const statCards = [
  { key: 'total_workers', label: 'Total Workers', icon: Users, color: 'from-indigo-500 to-indigo-600' },
  { key: 'current_raw_stock', label: 'Current Raw Stock', icon: Package, color: 'from-emerald-500 to-emerald-600' },
  { key: 'today_attendance', label: "Today's Total Attendance", icon: CalendarCheck, color: 'from-amber-500 to-amber-600' },
  { key: 'today_waste', label: "Today's Waste", icon: Trash2, color: 'from-rose-500 to-rose-600' },
  { key: 'monthly_salary_expense', label: 'Monthly Salary Expense', icon: Wallet, color: 'from-navy-700 to-navy-900' },
]

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [workData, setWorkData] = useState([])
  const [wasteTrend, setWasteTrend] = useState([])
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  
  const { getAttendanceSummary, attendanceRecords } = useAttendance()

  useEffect(() => {
    const load = async () => {
      try {
        const [dashRes, assignRes, wasteRes, workerRes] = await Promise.all([
          reportAPI.dashboard(),
          assignmentAPI.getAll({}),
          wasteAPI.getTrend({ days: 14 }),
          workerAPI.getAll({})
        ])
        
        if (dashRes.data.success) {
          const statsData = dashRes.data.data
          // Ensure we have all required stats with fallbacks
          setStats({
            total_workers: statsData.total_workers || 0,
            current_raw_stock: statsData.current_raw_stock || 0,
            today_attendance: statsData.today_attendance || 0,
            today_waste: statsData.today_waste || 0,
            monthly_salary_expense: statsData.monthly_salary_expense || 0
          })
        }
        
        if (assignRes.data.success) {
          const byDate = {}
          assignRes.data.data.forEach(a => {
            const d = a.date?.slice?.(0, 10) || a.date
            if (!byDate[d]) byDate[d] = 0
            byDate[d] += parseFloat(a.quantity_completed || 0)
          })
          setWorkData(Object.entries(byDate).slice(-14).map(([date, total]) => ({ date, total })))
        }
        
        if (wasteRes.data.success) {
          const wasteData = wasteRes.data.data || []
          console.log('Waste API Response:', wasteData)
          // Format waste data for chart
          setWasteTrend(wasteData.map(item => ({
            date: item.date?.slice?.(0, 10) || item.date,
            total: item.total || item.quantity || 0
          })))
        } else {
          console.log('Waste API failed:', wasteRes)
        }
        
        if (workerRes.data.success) {
          setWorkers(workerRes.data.data || [])
        }
        
      } catch (error) {
        console.error('Error loading dashboard data:', error)
      }
      setLoading(false)
      
      // Debug: Log final stats state
      setTimeout(() => {
        console.log('Final dashboard stats state:', stats)
      }, 1000)
    }
    load()
  }, [])

  // Get today's attendance from context
  const today = new Date().toISOString().slice(0, 10)
  const todayAttendanceSummary = getAttendanceSummary(today)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Spinning Mill Operations Overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {statCards.map(({ key, label, icon: Icon, color }, i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ scale: 1.02, y: -2 }}
            className="bg-white rounded-xl shadow-card border border-slate-100 p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="text-2xl font-bold text-navy-900 mt-1">
                  {key === 'today_attendance' 
                    ? stats?.today_attendance || 0
                    : stats?.[key] != null
                      ? key.includes('expense') || key.includes('stock') || key.includes('waste')
                        ? `${Number(stats[key]).toLocaleString()} kg`
                        : stats[key]
                      : '-'}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white`}>
                <Icon size={24} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-card border border-slate-100 p-6"
        >
          <h3 className="font-semibold text-navy-900 mb-4 flex items-center gap-2">
            <TrendingUp size={20} />
            Work Performance
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workData}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-card border border-slate-100 p-6"
        >
          <h3 className="font-semibold text-navy-900 mb-4 flex items-center gap-2">
            <Trash2 size={20} />
            Waste Trend (14 days)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={wasteTrend}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#e11d48" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Employee Work Allocation Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-card border border-slate-100 overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-navy-900 flex items-center gap-2">
            <Users size={20} />
            Employee Work Allocation
          </h3>
          <button 
            onClick={() => window.location.href = '/workers'}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Manage Employees
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Employee Name</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Department/Work Stage</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {workers.slice(0, 10).map((w) => (
                <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-medium text-navy-900">{w.name}</td>
                  <td className="px-6 py-4 text-slate-600">{w.preferred_work || w.work_type_name || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${w.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {w.status}
                    </span>
                  </td>
                </tr>
              ))}
              {workers.length === 0 && (
                <tr>
                  <td colSpan="3" className="px-6 py-8 text-center text-slate-500">No employees found</td>
                </tr>
              )}
            </tbody>
          </table>
          {workers.length > 10 && (
            <div className="p-4 text-center border-t border-slate-100">
              <p className="text-sm text-slate-500">Showing top 10 employees. View more in Workers page.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
