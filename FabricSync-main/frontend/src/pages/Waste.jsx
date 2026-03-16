import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trash2, Plus, Search } from 'lucide-react'
import Modal from '../components/Modal'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { wasteAPI } from '../services/api'

export default function Waste() {
  const [list, setList] = useState([])
  const [trend, setTrend] = useState([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ fabric_type: '', process_stage: '', quantity: '', date: new Date().toISOString().slice(0, 10), reason: '' })

  const load = async () => {
    setLoading(true)
    try {
      const [wRes, tRes] = await Promise.all([
        wasteAPI.getAll({ days }),
        wasteAPI.getTrend({ days })
      ])
      if (wRes.data.success) setList(wRes.data.data || [])
      if (tRes.data.success) setTrend(tRes.data.data || [])
    } catch (_) {}
    setLoading(false)
  }

  useEffect(() => { load() }, [days])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const res = await wasteAPI.create({
        fabric_type: form.fabric_type.trim(),
        process_stage: form.process_stage.trim(),
        quantity: parseFloat(form.quantity) || 0,
        date: form.date,
        reason: form.reason.trim()
      })
      const payload = res.data || {}
      if (payload.warning) {
        alert(`Warning: Waste exceeded daily limit (${payload.daily_total?.toFixed?.(2) ?? payload.daily_total} kg)`)
      }
      if (payload.notify_collector) {
        // Simulated notification to waste collector
        console.log('Send message to waste collector - total waste reached', payload.daily_total)
        alert('Notification: Send message to waste collector')
      }
      setModalOpen(false)
      setForm({ fabric_type: '', process_stage: '', quantity: '', date: new Date().toISOString().slice(0, 10), reason: '' })
      load()
    } catch (err) {
      alert(err.response?.data?.message || err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this record?')) return
    try {
      await wasteAPI.delete(id)
      load()
    } catch (err) {
      alert(err.response?.data?.message || err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Waste Management</h1>
          <p className="text-slate-500 mt-1">Record and track waste</p>
        </div>
        <div className="flex gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none">
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button onClick={() => { setForm({ fabric_type: '', process_stage: '', quantity: '', date: new Date().toISOString().slice(0, 10), reason: '' }); setModalOpen(true) }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-950 text-white hover:bg-navy-800">
            <Plus size={20} /> Record Waste
          </button>
        </div>
      </div>

      {list.some((r) => (r.daily_total || 0) > 6) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3"
        >
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-medium text-amber-800">Warning: Waste exceeded daily limit</p>
            <p className="text-sm text-amber-700">One or more days have waste &gt; 6 kg. Consider notifying waste collector if total ≥ 150 kg.</p>
          </div>
        </motion.div>
      )}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-card border border-slate-100 p-6">
        <h3 className="font-semibold text-navy-900 mb-4">Waste Trend</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#e11d48" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-card border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Date</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Fabric Type</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Process Stage</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Quantity</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Reason</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-6 py-4 text-slate-600">{r.date_str || r.date}</td>
                    <td className="px-6 py-4 font-medium text-navy-900">{r.fabric_type}</td>
                    <td className="px-6 py-4">{r.process_stage || '-'}</td>
                    <td className="px-6 py-4">{r.quantity}</td>
                    <td className="px-6 py-4 text-slate-600">{r.reason || '-'}</td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Waste">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fabric Type *</label>
            <input type="text" value={form.fabric_type} onChange={(e) => setForm({ ...form, fabric_type: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Process Stage</label>
            <input type="text" value={form.process_stage} onChange={(e) => setForm({ ...form, process_stage: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
            <input type="number" step="0.01" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
            <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-navy-950 text-white hover:bg-navy-800">Record</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
