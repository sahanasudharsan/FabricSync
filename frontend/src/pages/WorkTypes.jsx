import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Briefcase, Plus, Pencil, Trash2 } from 'lucide-react'
import Modal from '../components/Modal'
import { workTypeAPI } from '../services/api'

export default function WorkTypes() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ work_name: '', wage_type: 'per_day', wage_per_day: '', wage_per_unit: '', description: '' })

  const load = async () => {
    try {
      const { data } = await workTypeAPI.getAll()
      if (data.success) setList(data.data || [])
    } catch (_) {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditId(null)
    setForm({ work_name: '', wage_type: 'per_day', wage_per_day: '', wage_per_unit: '', description: '' })
    setModalOpen(true)
  }

  const openEdit = (w) => {
    setEditId(w.id)
    setForm({
      work_name: w.work_name,
      wage_type: w.wage_type || 'per_day',
      wage_per_day: w.wage_per_day ?? '',
      wage_per_unit: w.wage_per_unit ?? '',
      description: w.description || ''
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        work_name: form.work_name.trim(),
        wage_type: form.wage_type,
        wage_per_day: parseFloat(form.wage_per_day) || 0,
        wage_per_unit: parseFloat(form.wage_per_unit) || 0,
        description: form.description.trim()
      }
      if (editId) await workTypeAPI.update(editId, payload)
      else await workTypeAPI.create(payload)
      setModalOpen(false)
      load()
    } catch (err) {
      alert(err.response?.data?.message || err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this work type?')) return
    try {
      await workTypeAPI.delete(id)
      load()
    } catch (err) {
      alert(err.response?.data?.message || err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Work Types</h1>
          <p className="text-slate-500 mt-1">Different wages per work type</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-950 text-white hover:bg-navy-800 transition-colors"
        >
          <Plus size={20} />
          Add Work Type
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white rounded-xl shadow-card border border-slate-100 overflow-hidden"
      >
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Work Name</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Wage Type</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Rate</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Description</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((w) => (
                  <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium text-navy-900">{w.work_name}</td>
                    <td className="px-6 py-4 capitalize">{w.wage_type?.replace('_', ' ')}</td>
                    <td className="px-6 py-4">
                      {w.wage_type === 'per_day' ? `${w.wage_per_day} / day` : `${w.wage_per_unit} / unit`}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{w.description || '-'}</td>
                    <td className="px-6 py-4 flex gap-2">
                      <button onClick={() => openEdit(w)} className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600">
                        <Pencil size={18} />
                      </button>
                      <button onClick={() => handleDelete(w.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Work Type' : 'Add Work Type'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Work Name</label>
            <input
              type="text"
              value={form.work_name}
              onChange={(e) => setForm({ ...form, work_name: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Spinning, Winding, Packing..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Wage Type</label>
            <select
              value={form.wage_type}
              onChange={(e) => setForm({ ...form, wage_type: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="per_day">Per Day</option>
              <option value="per_unit">Per Unit</option>
            </select>
          </div>
          {form.wage_type === 'per_day' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Wage Per Day</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.wage_per_day}
                onChange={(e) => setForm({ ...form, wage_per_day: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Wage Per Unit</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.wage_per_unit}
                onChange={(e) => setForm({ ...form, wage_per_unit: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-navy-950 text-white hover:bg-navy-800">
              {editId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
