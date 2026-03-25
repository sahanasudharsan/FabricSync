import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, Plus, Pencil, Trash2, Search } from 'lucide-react'
import Modal from '../components/Modal'
import { workerAPI, workTypeAPI } from '../services/api'

export default function Workers() {
  const [list, setList] = useState([])
  const [workTypes, setWorkTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({
    name: '', phone: '', skill_type: '', assigned_work_type: '', preferred_work: '', shift_preference: '', role: 'worker', joining_date: '', status: 'active'
  })

  const load = async () => {
    try {
      const [wRes, wtRes] = await Promise.all([
        workerAPI.getAll({ search: search || undefined }),
        workTypeAPI.getAll()
      ])
      if (wRes.data.success) setList(wRes.data.data || [])
      if (wtRes.data.success) setWorkTypes(wtRes.data.data || [])
    } catch (_) {}
    setLoading(false)
  }

  useEffect(() => { load() }, [search])

  const openCreate = () => {
    setEditId(null)
    setForm({ name: '', phone: '', skill_type: '', assigned_work_type: '', preferred_work: '', shift_preference: '', role: 'worker', joining_date: new Date().toISOString().slice(0, 10), status: 'active' })
    setModalOpen(true)
  }

  const openEdit = (w) => {
    setEditId(w.id)
    const jd = w.joining_date
    setForm({
      name: w.name,
      phone: w.phone || '',
      skill_type: w.skill_type || '',
      assigned_work_type: w.assigned_work_type || '',
      preferred_work: w.preferred_work || w.work_type_name || '',
      shift_preference: w.shift_preference || '',
      role: w.role || 'worker',
      joining_date: typeof jd === 'string' ? jd.slice(0, 10) : (jd?.toISOString?.()?.slice(0, 10) || ''),
      status: w.status || 'active'
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = { ...form, assigned_work_type: form.assigned_work_type || undefined }
      if (editId) await workerAPI.update(editId, payload)
      else await workerAPI.create(payload)
      setModalOpen(false)
      load()
    } catch (err) {
      alert(err.response?.data?.message || err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this worker?')) return
    try {
      await workerAPI.delete(id)
      load()
    } catch (err) {
      alert(err.response?.data?.message || err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Workers</h1>
          <p className="text-slate-500 mt-1">Worker management</p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workers..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-950 text-white hover:bg-navy-800">
            <Plus size={20} />
            Add Worker
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
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Name</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Wage / Day</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Weekly Salary</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Shift</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Role</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((w) => (
                  <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium text-navy-900">{w.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{w.preferred_work || w.work_type_name || w.skill_type || '-'}</td>
                    <td className="px-6 py-4 font-semibold text-emerald-600">{w.work_type_wage ? `${w.work_type_wage} Rs` : '-'}</td>
                    <td className="px-6 py-4 font-bold text-indigo-600">{w.weekly_salary ? `${w.weekly_salary} Rs` : '0 Rs'}</td>
                    <td className="px-6 py-4 text-slate-600">{w.shift_preference ? `Shift ${w.shift_preference.replace('shift','')}` : '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${w.role === 'supervisor' ? 'bg-indigo-100 text-indigo-700' : w.role === 'fitter' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                        {w.role || 'worker'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${w.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {w.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 flex gap-2">
                      <button onClick={() => openEdit(w)} className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600"><Pencil size={18} /></button>
                      <button onClick={() => handleDelete(w.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Worker' : 'Add Worker'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Skill Type</label>
            <input type="text" value={form.skill_type} onChange={(e) => setForm({ ...form, skill_type: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Work Type *</label>
            <select value={form.assigned_work_type} onChange={(e) => { const wt = workTypes.find(x => x.id === e.target.value); setForm({ ...form, assigned_work_type: e.target.value, preferred_work: wt?.work_name || form.preferred_work }); }} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="">Select</option>
              {workTypes.map((wt) => <option key={wt.id} value={wt.id}>{wt.work_name} ({wt.wage_per_day} Rs/day)</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Shift Preference</label>
            <select value={form.shift_preference} onChange={(e) => setForm({ ...form, shift_preference: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="">Any</option>
              <option value="shift1">Shift 1 (6AM – 2PM)</option>
              <option value="shift2">Shift 2 (2PM – 10PM)</option>
              <option value="shift3">Shift 3 (10PM – 6AM)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="worker">Worker</option>
              <option value="supervisor">Supervisor</option>
              <option value="fitter">Fitter</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Joining Date</label>
            <input type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
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
