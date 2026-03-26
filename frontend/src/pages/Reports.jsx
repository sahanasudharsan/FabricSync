import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileText, Download, FileSpreadsheet } from 'lucide-react'
import { reportAPI } from '../services/api'

const reportTypes = [
  { key: 'salary', label: 'Monthly Salary Report', endpoint: 'salary' },
  { key: 'attendance', label: 'Attendance Report', endpoint: 'attendance' },
  { key: 'allocation', label: 'Daily Work Allocation', endpoint: 'allocation' },
  { key: 'waste', label: 'Waste Generation Summary', endpoint: 'waste' },
  { key: 'fabric', label: 'Fabric Stock Report', endpoint: 'fabric' }
]

export default function Reports() {
  const [active, setActive] = useState('salary')
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [data, setData] = useState([])
  const [summary, setSummary] = useState({})
  const [loading, setLoading] = useState(true)

  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10))
  const [allocationView, setAllocationView] = useState('date') // 'date' | 'month'

  const load = async () => {
    setLoading(true)
    try {
      let params = {}
      if (active === 'fabric') params = {}
      else if (active === 'waste') params = { days: 30, month }
      else if (active === 'allocation') params = allocationView === 'date' ? { date: dateFilter } : { month }
      else params = { month }
      const fn = reportAPI[active]
      if (fn) {
        const res = await fn(params)
        if (res.data.success) {
          setData(res.data.data || [])
          setSummary(res.data.summary || {})
        }
      }
    } catch (_) {}
    setLoading(false)
  }

  useEffect(() => { load() }, [active, month, dateFilter, allocationView])

  const downloadCsv = () => {
    const base = import.meta.env.VITE_API_URL || ''
    let params = ''
    if (active === 'fabric') params = '?export=csv'
    else if (active === 'waste') params = `?month=${month}&days=30&export=csv`
    else if (active === 'allocation') params = allocationView === 'date' ? `?date=${dateFilter}&export=csv` : `?month=${month}&export=csv`
    else params = `?month=${month}&export=csv`
    const url = `${base}/api/reports/${active}${params}`
    const token = localStorage.getItem('token')
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${active}_report_${month || dateFilter || 'export'}.csv`
        a.click()
        URL.revokeObjectURL(a.href)
      })
      .catch(() => alert('Download failed. Ensure backend is running.'))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Reports</h1>
        <p className="text-slate-500 mt-1">View and export reports</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {reportTypes.map((r) => (
          <button
            key={r.key}
            onClick={() => setActive(r.key)}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${active === r.key ? 'bg-navy-950 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        {(active === 'salary' || active === 'attendance' || active === 'waste') && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Month:</label>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
        )}
        {active === 'allocation' && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">View:</span>
              <select value={allocationView} onChange={(e) => setAllocationView(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="date">By Date</option>
                <option value="month">By Month</option>
              </select>
            </div>
            {allocationView === 'date' && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">Date:</label>
                <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            )}
            {allocationView === 'month' && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">Month:</label>
                <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            )}
          </>
        )}
        <button onClick={downloadCsv} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">
          <Download size={18} />
          Export CSV
        </button>
      </div>

      {Object.keys(summary).length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(summary).map(([k, v]) => {
            // Handle nested objects in summary
            if (typeof v === 'object' && v !== null) {
              return null // Skip nested objects for now
            }
            return (
              <div key={k} className="bg-white rounded-xl shadow-card border border-slate-100 p-4">
                <p className="text-xs text-slate-500 capitalize">{k.replace(/_/g, ' ')}</p>
                <p className="text-lg font-semibold text-navy-900">
                  {typeof v === 'number' ? v.toLocaleString() : v}
                  {k.includes('percentage') && '%' && ' %'}
                  {k.includes('stock') && ' kg'}
                  {k.includes('waste') && ' kg'}
                  {k.includes('manufactured') && ' kg'}
                  {k.includes('used') && ' kg'}
                </p>
              </div>
            )
          })}
        </motion.div>
      )}

      {/* Enhanced summary for waste report */}
      {active === 'waste' && summary.total_waste !== undefined && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-card border border-slate-100 p-6">
          <h3 className="font-semibold text-navy-900 mb-4">Waste Analysis Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-rose-50 rounded-lg p-4">
              <p className="text-sm text-slate-600">Total Waste</p>
              <p className="text-2xl font-bold text-rose-600">{summary.total_waste} kg</p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4">
              <p className="text-sm text-slate-600">Raw Material Used</p>
              <p className="text-2xl font-bold text-indigo-600">{summary.total_raw_used} kg</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4">
              <p className="text-sm text-slate-600">Manufactured Product</p>
              <p className="text-2xl font-bold text-emerald-600">{summary.total_manufactured} kg</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <p className="text-sm text-slate-600">Waste %</p>
              <p className="text-2xl font-bold text-amber-600">{summary.waste_percentage}%</p>
            </div>
          </div>
          {summary.warning_days > 0 && (
            <div className="mt-4 bg-rose-50 border border-rose-200 rounded-lg p-4">
              <p className="text-sm text-rose-700">
                <strong>Warning:</strong> {summary.warning_days} days with waste exceeding 6 kg limit
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Enhanced summary for fabric report */}
      {active === 'fabric' && summary.current_raw_stock !== undefined && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-card border border-slate-100 p-6">
          <h3 className="font-semibold text-navy-900 mb-4">Stock Analysis Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-emerald-50 rounded-lg p-4">
              <p className="text-sm text-slate-600">Current Raw Stock</p>
              <p className="text-2xl font-bold text-emerald-600">{summary.current_raw_stock} kg</p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4">
              <p className="text-sm text-slate-600">Total Fabric Stock</p>
              <p className="text-2xl font-bold text-indigo-600">{summary.total_fabric_stock} kg</p>
            </div>
            <div className="bg-rose-50 rounded-lg p-4">
              <p className="text-sm text-slate-600">Low Stock Items</p>
              <p className="text-2xl font-bold text-rose-600">{summary.low_stock_count}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-600">Total Items</p>
              <p className="text-2xl font-bold text-slate-600">{summary.total_items}</p>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-card border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No data</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {Object.keys(data[0]).filter(k => !['id', '_id'].includes(k)).map((k) => (
                    <th key={k} className="text-left px-6 py-4 text-sm font-medium text-slate-600 capitalize">
                      {k.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                    {Object.entries(row).filter(([k]) => !['id', '_id'].includes(k)).map(([k, v]) => (
                      <td key={k} className="px-6 py-4 text-slate-700">
                        {typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(2)) : String(v ?? '-')}
                      </td>
                    ))}
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
