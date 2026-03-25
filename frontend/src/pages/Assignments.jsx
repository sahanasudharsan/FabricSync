import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ClipboardList, Plus, Pencil, Trash2, Zap } from 'lucide-react'
import Modal from '../components/Modal'
import { assignmentAPI, workerAPI, workTypeAPI, operationsAPI } from '../services/api'

const SHIFT_LABELS = { shift1: '6AM–2PM', shift2: '2PM–10PM', shift3: '10PM–6AM' }

export default function Assignments() {
  const [list, setList] = useState([])
  const [workers, setWorkers] = useState([])
  const [workTypes, setWorkTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [assignLoading, setAssignLoading] = useState(false)
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10))
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({
    worker_id: '', work_type_id: '', quantity_completed: '', date: new Date().toISOString().slice(0, 10), shift: 'shift1', status: 'pending'
  })

  const load = async () => {
    setLoading(true)
    try {
      const [aRes, wRes, wtRes] = await Promise.all([
        assignmentAPI.getAll({ date: dateFilter }),
        workerAPI.getAll({ status: 'active' }),
        workTypeAPI.getAll()
      ])
      if (aRes.data.success) setList(aRes.data.data || [])
      if (wRes.data.success) setWorkers(wRes.data.data || [])
      if (wtRes.data.success) setWorkTypes(wtRes.data.data || [])
    } catch (_) {}
    setLoading(false)
  }

  useEffect(() => { load() }, [dateFilter])

  const handleAutoAssign = async () => {
    setAssignLoading(true)
    try {
      const { data } = await operationsAPI.workAssign({ date: dateFilter })
      if (data?.success) {
        alert(data.message || 'Work assigned successfully')
        load()
      } else {
        alert(data?.message || 'Auto-assign failed')
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Auto-assign failed')
    }
    setAssignLoading(false)
  }

  const openCreate = () => {
    setEditId(null)
    setForm({
      worker_id: '', work_type_id: '', quantity_completed: '', date: dateFilter || new Date().toISOString().slice(0, 10), shift: 'shift1', status: 'pending'
    })
    setModalOpen(true)
  }

  const openEdit = (a) => {
    setEditId(a.id)
    setForm({
      worker_id: a.worker_id,
      work_type_id: a.work_type_id,
      quantity_completed: a.quantity_completed ?? '',
      date: (a.date && String(a.date).slice(0, 10)) || dateFilter,
      shift: a.shift || 'shift1',
      status: a.status || 'pending'
    })
    setModalOpen(true)
  }

  const getWage = (a) => {
    const wt = workTypes.find(x => x.id === a.work_type_id)
    return wt ? (wt.wage_per_day ?? 0) : 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        worker_id: form.worker_id,
        work_type_id: form.work_type_id,
        quantity_completed: parseFloat(form.quantity_completed) || 0,
        date: form.date,
        shift: form.shift,
        status: form.status
      }
      if (editId) await assignmentAPI.update(editId, payload)
      else await assignmentAPI.create(payload)
      setModalOpen(false)
      load()
    } catch (err) {
      alert(err.response?.data?.message || err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this assignment?')) return
    try {
      await assignmentAPI.delete(id)
      load()
    } catch (err) {
      alert(err.response?.data?.message || err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Work Allocation</h1>
          <p className="text-slate-500 mt-1">Assign work to present workers by date and shift</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button
            onClick={handleAutoAssign}
            disabled={assignLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-70"
          >
            {assignLoading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Zap size={20} />}
            Auto Assign
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-950 text-white hover:bg-navy-800">
            <Plus size={20} /> Add Assignment
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
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Worker</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Work Type</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Shift</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Daily Wage</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Date</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium text-navy-900">{a.worker_name}</td>
                    <td className="px-6 py-4">{a.work_type_name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${a.shift === 'shift1' ? 'bg-sky-100 text-sky-700' : a.shift === 'shift2' ? 'bg-amber-100 text-amber-700' : a.shift === 'shift3' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
                        {SHIFT_LABELS[a.shift] || a.shift || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-emerald-600">{getWage(a)} Rs</td>
                    <td className="px-6 py-4 text-slate-600">{String(a.date).slice(0, 10)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${a.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{a.status}</span>
                    </td>
                    <td className="px-6 py-4 flex gap-2">
                      <button onClick={() => openEdit(a)} className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600"><Pencil size={18} /></button>
                      <button onClick={() => handleDelete(a.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Assignment' : 'Add Assignment'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Worker *</label>
            <select value={form.worker_id} onChange={(e) => setForm({ ...form, worker_id: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" required>
              <option value="">Select</option>
              {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Work Type *</label>
            <select value={form.work_type_id} onChange={(e) => setForm({ ...form, work_type_id: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" required>
              <option value="">Select</option>
              {workTypes.map((wt) => <option key={wt.id} value={wt.id}>{wt.work_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Shift</label>
            <select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="shift1">Shift 1 (6AM – 2PM)</option>
              <option value="shift2">Shift 2 (2PM – 10PM)</option>
              <option value="shift3">Shift 3 (10PM – 6AM)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity Completed</label>
            <input type="number" step="0.01" min="0" value={form.quantity_completed} onChange={(e) => setForm({ ...form, quantity_completed: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-navy-950 text-white hover:bg-navy-800">{editId ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
