import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CalendarCheck, Trash2, Calendar } from 'lucide-react'
import Modal from '../components/Modal'
import { attendanceAPI, workerAPI } from '../services/api'
import { useAttendance } from '../contexts/AttendanceContext'

export default function Attendance() {
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [shift, setShift] = useState('shift1')
  const [presentMap, setPresentMap] = useState({})
  const [originalPresentMap, setOriginalPresentMap] = useState({})
  
  const { 
    attendanceRecords, 
    loading: attendanceLoading, 
    refreshAttendance, 
    bulkMarkAttendance, 
    deleteAttendance,
    getWorkerAttendance 
  } = useAttendance()

  const load = async () => {
    setLoading(true)
    try {
      const [wRes] = await Promise.all([
        workerAPI.getAll({ status: 'active' })
      ])
      
      if (wRes.data.success) {
        const ws = wRes.data.data || []
        setWorkers(ws)
        
        // Update present map based on current attendance records
        const present = {}
        ws.forEach((w) => {
          const attendance = getWorkerAttendance(w.id, date)
          present[w.id] = attendance?.status === 'present'
        })
        setPresentMap(present)
        setOriginalPresentMap(present) // Store original state to track changes
      }
    } catch (_) {}
    setLoading(false)
  }

  useEffect(() => { 
    load()
    refreshAttendance({ date }) 
  }, [date])

  const handleToggle = (workerId) => {
    setPresentMap((prev) => ({ ...prev, [workerId]: !prev[workerId] }))
  }

  const handleReset = () => {
    setPresentMap(originalPresentMap)
  }

  const handleSaveBulk = async () => {
    try {
      // Only send changed records, not all workers
      const changedRecords = []
      
      workers.forEach((w) => {
        const currentStatus = presentMap[w.id]
        const originalStatus = originalPresentMap[w.id]
        
        // Only include if status changed or if it's a new record
        if (currentStatus !== originalStatus || originalStatus === undefined) {
          changedRecords.push({
            worker_id: w.id,
            status: currentStatus ? 'present' : 'absent',
          })
        }
      })
      
      if (changedRecords.length === 0) {
        alert('No changes to save')
        return
      }
      
      const result = await bulkMarkAttendance({ date, shift, records: changedRecords })
      if (result.success) {
        const { inserted, updated, skipped } = result
        let message = ''
        if (inserted > 0) message += `Created ${inserted} new record${inserted > 1 ? 's' : ''}. `
        if (updated > 0) message += `Updated ${updated} existing record${updated > 1 ? 's' : ''}. `
        if (skipped > 0) message += `Skipped ${skipped} record${skipped > 1 ? 's' : ''}. `
        
        alert(message || 'Attendance processed successfully!')
        // Refresh to get updated state
        await refreshAttendance({ date })
        load() // Reload to update present map
      } else {
        alert(result.message || 'Failed to save attendance')
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Remove this attendance record?')) return
    try {
      const result = await deleteAttendance(id)
      if (result.success) {
        load() // Reload to update present map
      } else {
        alert(result.message || 'Failed to delete attendance')
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message)
    }
  }

  // Filter attendance records for current date
  const todayRecords = attendanceRecords.filter(r => r.date === date)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Attendance</h1>
          <p className="text-slate-500 mt-1">Mark daily attendance</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-slate-500" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="shift1">Shift 1 (6AM – 2PM)</option>
            <option value="shift2">Shift 2 (2PM – 10PM)</option>
            <option value="shift3">Shift 3 (10PM – 6AM)</option>
          </select>
          <button
            onClick={handleSaveBulk}
            className="px-4 py-2.5 rounded-xl bg-navy-950 text-white hover:bg-navy-800"
          >
            Save Attendance
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2.5 rounded-xl bg-slate-500 text-white hover:bg-slate-600"
          >
            Reset Changes
          </button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-card border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
          <CalendarCheck className="text-indigo-600" size={20} />
          <div>
            <p className="font-semibold text-navy-900">Mark Attendance</p>
            <p className="text-xs text-slate-500">Select present workers for {date} – {shift.toUpperCase()}</p>
          </div>
        </div>
        {loading || attendanceLoading ? (
          <div className="p-6 text-center text-slate-500">Loading workers...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">Present</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">Worker</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">Work</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">Wage / Day</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-slate-600">Shift Pref</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-6 py-3">
                      <input
                        type="checkbox"
                        checked={!!presentMap[w.id]}
                        onChange={() => handleToggle(w.id)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-6 py-3 font-medium text-navy-900">{w.name}</td>
                    <td className="px-6 py-3 text-slate-600 text-sm">{w.preferred_work || w.work_type_name || '-'}</td>
                    <td className="px-6 py-3 font-semibold text-emerald-600 text-sm">{w.work_type_wage ? `${w.work_type_wage} Rs` : (w.wage_per_day ? `${w.wage_per_day} Rs` : '-')}</td>
                    <td className="px-6 py-3 text-slate-600 text-sm">{w.shift_preference || 'Any'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-card border border-slate-100 overflow-hidden">
        {loading || attendanceLoading ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Worker</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Date</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {todayRecords.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium text-navy-900">{r.worker_name}</td>
                    <td className="px-6 py-4 text-slate-600">{r.date}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${r.status === 'present' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{r.status}</span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {r.shift === 'shift1' && 'Shift 1 (6AM – 2PM)'}
                      {r.shift === 'shift2' && 'Shift 2 (2PM – 10PM)'}
                      {r.shift === 'shift3' && 'Shift 3 (10PM – 6AM)'}
                      {!r.shift && '-'}
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => handleDelete(r.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  )
}
