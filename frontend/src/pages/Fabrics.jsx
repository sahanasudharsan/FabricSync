import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Package, Plus, Pencil, Trash2, Search, AlertTriangle } from 'lucide-react'
import Modal from '../components/Modal'
import { fabricAPI } from '../services/api'

export default function Fabrics() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ fabric_name: '', type: '', quantity: '', threshold_limit: '' })

  const load = async () => {
    try {
      const { data } = await fabricAPI.getAll({ search: search || undefined })
      if (data.success) setList(data.data || [])
    } catch (_) {}
    setLoading(false)
  }

  useEffect(() => { load() }, [search])

  const openCreate = () => {
    setEditId(null)
    setForm({ fabric_name: '', type: '', quantity: '', threshold_limit: '' })
    setModalOpen(true)
  }

  const openEdit = (f) => {
    setEditId(f.id)
    setForm({
      fabric_name: f.fabric_name,
      type: f.type || '',
      quantity: f.quantity ?? '',
      threshold_limit: f.threshold_limit ?? ''
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        fabric_name: form.fabric_name.trim(),
        type: form.type.trim(),
        quantity: parseFloat(form.quantity) || 0,
        threshold_limit: parseFloat(form.threshold_limit) || 0
      }
      if (editId) await fabricAPI.update(editId, payload)
      else await fabricAPI.create(payload)
      setModalOpen(false)
      load()
    } catch (err) {
      alert(err.response?.data?.message || err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this fabric?')) return
    try {
      await fabricAPI.delete(id)
      load()
    } catch (err) {
      alert(err.response?.data?.message || err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Fabric Stock</h1>
          <p className="text-slate-500 mt-1">Manage fabric inventory</p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-950 text-white hover:bg-navy-800">
            <Plus size={20} /> Add Fabric
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
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Fabric</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Type</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Quantity</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Threshold</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((f) => (
                  <tr key={f.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${f.is_low_stock ? 'bg-amber-50/50' : ''}`}>
                    <td className="px-6 py-4 font-medium text-navy-900">{f.fabric_name}</td>
                    <td className="px-6 py-4 text-slate-600">{f.type || '-'}</td>
                    <td className="px-6 py-4">{Number(f.quantity).toLocaleString()}</td>
                    <td className="px-6 py-4">{Number(f.threshold_limit || 0).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      {f.is_low_stock ? (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-800">
                          <AlertTriangle size={14} /> Low Stock
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700">OK</span>
                      )}
                    </td>
                    <td className="px-6 py-4 flex gap-2">
                      <button onClick={() => openEdit(f)} className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600"><Pencil size={18} /></button>
                      <button onClick={() => handleDelete(f.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Fabric' : 'Add Fabric'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fabric Name *</label>
            <input type="text" value={form.fabric_name} onChange={(e) => setForm({ ...form, fabric_name: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
            <input type="text" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Cotton, Blend, etc." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
            <input type="number" step="0.01" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Low Stock Threshold</label>
            <input type="number" step="0.01" min="0" value={form.threshold_limit} onChange={(e) => setForm({ ...form, threshold_limit: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
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
