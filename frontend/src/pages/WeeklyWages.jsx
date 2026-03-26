import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Wallet, Plus, Pencil, Trash2, Search, Calculator, RefreshCw } from 'lucide-react'
import Modal from '../components/Modal'
import { weeklyWageAPI, workerAPI, workTypeAPI } from '../services/api'
import { useAttendance } from '../contexts/AttendanceContext'

export default function WeeklyWages() {
  const [list, setList] = useState([])
  const [workers, setWorkers] = useState([])
  const [workTypes, setWorkTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({
    worker_id: '', work_type_id: '', shifts_performed: '', salary_per_shift: '', weekly_wages: 0
  })
  
  const { refreshAttendance } = useAttendance()

  // Calculate weekly wages automatically
  const handleCalculateWages = async () => {
    setCalculating(true)
    try {
      const response = await weeklyWageAPI.calculate({})
      if (response.data.success) {
        alert(`Successfully calculated wages for ${response.data.data.length} workers!`)
        load() // Refresh the data
        refreshAttendance() // Refresh attendance data
      } else {
        alert(response.data.message || 'Failed to calculate wages')
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message)
    } finally {
      setCalculating(false)
    }
  }

  // Load all data
  const load = async () => {
    try {
      const [wRes, wtRes, wwRes] = await Promise.all([
        workerAPI.getAll({}),
        workTypeAPI.getAll(),
        weeklyWageAPI.getAll({ search: search || undefined })
      ])
      if (wRes.data.success) setWorkers(wRes.data.data || [])
      if (wtRes.data.success) setWorkTypes(wtRes.data.data || [])
      if (wwRes.data.success) setList(wwRes.data.data || [])
    } catch (_) {}
    setLoading(false)
  }

  useEffect(() => { load() }, [search])

  // Calculation logic
  useEffect(() => {
    const shifts = parseFloat(form.shifts_performed) || 0
    const salary = parseFloat(form.salary_per_shift) || 0
    setForm(prev => ({ ...prev, weekly_wages: (shifts * salary).toFixed(2) }))
  }, [form.shifts_performed, form.salary_per_shift])

  const openCreate = () => {
    setEditId(null)
    setForm({ worker_id: '', work_type_id: '', shifts_performed: '', salary_per_shift: '', weekly_wages: 0 })
    setModalOpen(true)
  }

  const openEdit = (record) => {
    setEditId(record.id)
    setForm({
      worker_id: record.worker_id,
      work_type_id: record.work_type_id,
      shifts_performed: record.shifts_performed,
      salary_per_shift: record.salary_per_shift,
      weekly_wages: record.weekly_wages
    })
    setModalOpen(true)
  }

  const handleDepartmentChange = (workTypeId) => {
    const wt = workTypes.find(x => x.id === workTypeId)
    setForm(prev => ({ 
      ...prev, 
      work_type_id: workTypeId,
      salary_per_shift: wt?.wage_per_day || 0
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = { 
        ...form, 
        shifts_performed: parseFloat(form.shifts_performed),
        salary_per_shift: parseFloat(form.salary_per_shift)
      }
      if (editId) await weeklyWageAPI.update(editId, payload)
      else await weeklyWageAPI.create(payload)
      setModalOpen(false)
      load()
    } catch (err) {
      alert(err.response?.data?.message || err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this record?')) return
    try {
      await weeklyWageAPI.delete(id)
      load()
    } catch (err) {
      alert(err.response?.data?.message || err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Weekly Wages</h1>
          <p className="text-slate-500 mt-1">Automatic weekly wage calculation based on shifts</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleCalculateWages}
            disabled={calculating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={20} className={calculating ? 'animate-spin' : ''} />
            {calculating ? 'Calculating...' : 'Auto Calculate'}
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-950 text-white hover:bg-navy-800">
            <Plus size={20} />
            Add Record
          </button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-card border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Employee Name</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Work Department</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Shifts Performed</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Salary Per Shift</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Weekly Wages</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium text-navy-900">{r.worker_name}</td>
                    <td className="px-6 py-4 text-slate-600">{r.work_type_name}</td>
                    <td className="px-6 py-4 font-semibold text-indigo-600">{r.shifts_performed} shifts</td>
                    <td className="px-6 py-4 text-slate-600">{r.salary_per_shift} Rs</td>
                    <td className="px-6 py-4 font-bold text-emerald-600">{r.weekly_wages} Rs</td>
                    <td className="px-6 py-4 flex gap-2">
                      <button onClick={() => openEdit(r)} className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600"><Pencil size={18} /></button>
                      <button onClick={() => handleDelete(r.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-slate-500">No records found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Record' : 'Add Weekly Wage Record'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
            <select 
              value={form.worker_id} 
              onChange={(e) => setForm({ ...form, worker_id: e.target.value })} 
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
              required
            >
              <option value="">Select Employee</option>
              {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Work Department *</label>
            <select 
              value={form.work_type_id} 
              onChange={(e) => handleDepartmentChange(e.target.value)} 
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
              required
            >
              <option value="">Select Department</option>
              {workTypes.map((wt) => <option key={wt.id} value={wt.id}>{wt.work_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Salary per Shift</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={form.salary_per_shift} 
                  readOnly
                  className="w-full pl-4 pr-12 py-2 rounded-xl border border-slate-100 bg-slate-50 text-slate-500 outline-none cursor-not-allowed" 
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">Rs</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Shifts Performed *</label>
              <input 
                type="number" 
                step="0.5"
                value={form.shifts_performed} 
                onChange={(e) => setForm({ ...form, shifts_performed: e.target.value })} 
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" 
                required 
              />
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-700 font-medium">
              <Calculator size={18} />
              <span>Total Weekly Wage</span>
            </div>
            <span className="text-xl font-bold text-indigo-900">{form.weekly_wages} Rs</span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-navy-950 text-white hover:bg-navy-800">{editId ? 'Update' : 'Create Record'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
