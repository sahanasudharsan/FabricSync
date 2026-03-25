import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Search, Filter, Download, Users, TrendingUp, Eye } from 'lucide-react'
import { attendanceHistoryAPI, workerAPI } from '../services/api'

export default function AttendanceHistory() {
  const [records, setRecords] = useState([])
  const [workers, setWorkers] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    worker_id: '',
    start_date: '',
    end_date: '',
    status: '',
    page: 1,
    limit: 50
  })
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 })
  const [showSummary, setShowSummary] = useState(false)

  const loadRecords = async () => {
    setLoading(true)
    try {
      const [recordsRes, summaryRes] = await Promise.all([
        attendanceHistoryAPI.getAll(filters),
        attendanceHistoryAPI.getSummary(filters)
      ])
      
      if (recordsRes.data.success) {
        setRecords(recordsRes.data.data || [])
        setPagination(recordsRes.data.pagination)
      }
      if (summaryRes.data.success) {
        setSummary(summaryRes.data.data)
      }
    } catch (error) {
      console.error('Error loading attendance history:', error)
    }
    setLoading(false)
  }

  const loadWorkers = async () => {
    try {
      const response = await workerAPI.getAll({ status: 'active' })
      if (response.data.success) {
        setWorkers(response.data.data || [])
      }
    } catch (error) {
      console.error('Error loading workers:', error)
    }
  }

  useEffect(() => {
    loadRecords()
  }, [filters])

  useEffect(() => {
    loadWorkers()
  }, [])

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }))
  }

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }))
  }

  const exportData = () => {
    const csvContent = [
      ['Date', 'Employee Name', 'Status', 'Shift'],
      ...records.map(r => [
        r.date,
        r.worker_name,
        r.status,
        r.shift || '-'
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance_history_${filters.start_date || 'all'}_to_${filters.end_date || 'all'}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Attendance History</h1>
          <p className="text-slate-500 mt-1">View and filter attendance records</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSummary(!showSummary)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <TrendingUp size={20} />
            {showSummary ? 'Hide Summary' : 'Show Summary'}
          </button>
          <button
            onClick={exportData}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Download size={20} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Section */}
      {showSummary && summary && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white rounded-xl shadow-card border border-slate-100 p-6"
        >
          <h3 className="font-semibold text-navy-900 mb-4 flex items-center gap-2">
            <Users size={20} />
            Attendance Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-600">Total Records</p>
              <p className="text-2xl font-bold text-navy-900">{summary.total_records}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4">
              <p className="text-sm text-slate-600">Present Days</p>
              <p className="text-2xl font-bold text-emerald-600">{summary.present_count}</p>
            </div>
            <div className="bg-rose-50 rounded-lg p-4">
              <p className="text-sm text-slate-600">Absent Days</p>
              <p className="text-2xl font-bold text-rose-600">{summary.absent_count}</p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4">
              <p className="text-sm text-slate-600">Attendance %</p>
              <p className="text-2xl font-bold text-indigo-600">{summary.overall_percentage}%</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-card border border-slate-100 p-6">
        <h3 className="font-semibold text-navy-900 mb-4 flex items-center gap-2">
          <Filter size={20} />
          Filters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee</label>
            <select
              value={filters.worker_id}
              onChange={(e) => handleFilterChange('worker_id', e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">All Employees</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => handleFilterChange('start_date', e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => handleFilterChange('end_date', e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
            </select>
          </div>
        </div>
      </motion.div>

      {/* Records Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-card border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading attendance records...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Date</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Employee Name</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Status</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Shift</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Marked On</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-medium text-navy-900">{record.date}</td>
                      <td className="px-6 py-4 text-slate-600">{record.worker_name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          record.status === 'present' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-rose-100 text-rose-700'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-sm">
                        {record.shift === 'shift1' && 'Shift 1 (6AM – 2PM)'}
                        {record.shift === 'shift2' && 'Shift 2 (2PM – 10PM)'}
                        {record.shift === 'shift3' && 'Shift 3 (10PM – 6AM)'}
                        {!record.shift && '-'}
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-sm">
                        {new Date(record.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                        No attendance records found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="p-4 border-t border-slate-200 flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} records
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 rounded-lg border border-slate-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-sm text-slate-600">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                    className="px-3 py-1 rounded-lg border border-slate-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  )
}
