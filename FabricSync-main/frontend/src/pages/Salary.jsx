import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Wallet, Calculator, Pencil } from 'lucide-react'
import Modal from '../components/Modal'
import { salaryAPI } from '../services/api'

export default function Salary() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [calcLoading, setCalcLoading] = useState(false)
  const [weeklyPayroll, setWeeklyPayroll] = useState(null)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const [form, setForm] = useState({ overtime: '', bonus: '', deductions: '' })

  const load = async () => {
    setLoading(true)
    try {
      const [sRes, wRes] = await Promise.all([
        salaryAPI.getAll({ month }),
        salaryAPI.getWeeklyPayroll()
      ])
      if (sRes.data.success) setList(sRes.data.data || [])
      if (wRes.data.success) setWeeklyPayroll(wRes.data.data)
    } catch (_) {}
    setLoading(false)
  }

  useEffect(() => { load() }, [month])

  const handleCalculate = async () => {
    setCalcLoading(true)
    try {
      const { data } = await salaryAPI.calculate({ month })
      load()
      if (data?.message) alert(data.message)
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Calculation failed')
    }
    setCalcLoading(false)
  }

  const openEdit = (s) => {
    setEditRecord(s)
    setForm({
      overtime: s.overtime ?? '',
      bonus: s.bonus ?? '',
      deductions: s.deductions ?? ''
    })
    setModalOpen(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    try {
      await salaryAPI.update(editRecord.id, {
        overtime: parseFloat(form.overtime) || 0,
        bonus: parseFloat(form.bonus) || 0,
        deductions: parseFloat(form.deductions) || 0
      })
      setModalOpen(false)
      load()
    } catch (err) {
      alert(err.response?.data?.message || err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Salary & Payroll</h1>
          <p className="text-slate-500 mt-1">Automatic salary calculation and weekly payroll summary</p>
        </div>
        <div className="flex gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button
            onClick={handleCalculate}
            disabled={calcLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-70"
          >
            {calcLoading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Calculator size={20} />}
            Calculate Monthly
          </button>
        </div>
      </div>

      {weeklyPayroll && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-navy-950 text-white p-6 rounded-2xl shadow-xl">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-xl">
                <Wallet className="text-emerald-400" size={24} />
              </div>
              <div>
                <p className="text-slate-400 text-sm font-medium">Total Weekly Payroll</p>
                <p className="text-2xl font-bold mt-1">{weeklyPayroll.total_payroll.toLocaleString()} Rs</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-card border border-slate-100 col-span-2">
            <p className="text-navy-900 font-bold mb-4">Weekly Payroll Summary ({weeklyPayroll.start_of_week} to {weeklyPayroll.end_of_week})</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {weeklyPayroll.employees.slice(0, 4).map(emp => (
                <div key={emp.id} className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-sm font-bold text-navy-900 truncate">{emp.name}</p>
                  <p className="text-xs text-indigo-600 font-medium">{emp.weekly_salary} Rs</p>
                </div>
              ))}
              {weeklyPayroll.employees.length > 4 && (
                <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                  <p className="text-xs text-slate-500">+{weeklyPayroll.employees.length - 4} more...</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      <div className="bg-white rounded-xl shadow-card border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-navy-900">Monthly Calculations</h2>
        </div>
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Worker</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Present Days</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Work Done</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Base</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Overtime</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Bonus</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Deductions</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Final</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium text-navy-900">{s.worker_name}</td>
                    <td className="px-6 py-4">{s.total_present_days}</td>
                    <td className="px-6 py-4">{s.total_work_done}</td>
                    <td className="px-6 py-4">{Number(s.calculated_salary).toFixed(2)}</td>
                    <td className="px-6 py-4">{Number(s.overtime || 0).toFixed(2)}</td>
                    <td className="px-6 py-4">{Number(s.bonus || 0).toFixed(2)}</td>
                    <td className="px-6 py-4">{Number(s.deductions || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 font-semibold text-emerald-600">{Number(s.final_salary).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <button onClick={() => openEdit(s)} className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600"><Pencil size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Edit Overtime / Bonus / Deductions">
        {editRecord && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <p className="text-slate-600">Worker: <strong>{editRecord.worker_name}</strong></p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Overtime</label>
              <input type="number" step="0.01" value={form.overtime} onChange={(e) => setForm({ ...form, overtime: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bonus</label>
              <input type="number" step="0.01" value={form.bonus} onChange={(e) => setForm({ ...form, bonus: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Deductions</label>
              <input type="number" step="0.01" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-navy-950 text-white hover:bg-navy-800">Update</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
