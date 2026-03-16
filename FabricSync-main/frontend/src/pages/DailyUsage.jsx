import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingDown, Plus, Pencil, Trash2, Search, AlertTriangle, Calendar, BarChart3, Package } from 'lucide-react'
import Modal from '../components/Modal'
import { dailyUsageAPI } from '../services/api'

export default function DailyUsage() {
  const [records, setRecords] = useState([])
  const [reductionHistory, setReductionHistory] = useState([])
  const [rawStock, setRawStock] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [showRawStockModal, setShowRawStockModal] = useState(false)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    total_raw_stock: '',
    raw_stock_used: '',
    remaining_raw_stock: '',
    fabric_produced: ''
  })
  const [rawStockForm, setRawStockForm] = useState({
    total_raw_stock: ''
  })
  const [productionWarning, setProductionWarning] = useState(false)

  const loadRecords = async () => {
    setLoading(true)
    try {
      const [recordsRes, stockRes] = await Promise.all([
        dailyUsageAPI.getAll({}),
        dailyUsageAPI.getRawStock()
      ])
      
      if (recordsRes.data.success) {
        setRecords(recordsRes.data.data || [])
      }
      if (stockRes.data.success) {
        setRawStock(stockRes.data.data)
      }
    } catch (error) {
      console.error('Error loading daily usage:', error)
    }
    setLoading(false)
  }

  const loadReductionHistory = async () => {
    try {
      const response = await dailyUsageAPI.getReductionHistory({ summary: 'monthly' })
      if (response.data.success) {
        setReductionHistory(response.data.data.history || [])
      }
    } catch (error) {
      console.error('Error loading reduction history:', error)
    }
  }

  useEffect(() => {
    loadRecords()
  }, [])

  useEffect(() => {
    if (showHistory) {
      loadReductionHistory()
    }
  }, [showHistory])

  const openCreate = () => {
    setEditId(null)
    setForm({
      date: new Date().toISOString().slice(0, 10),
      total_raw_stock: '',
      raw_stock_used: '',
      remaining_raw_stock: '',
      fabric_produced: ''
    })
    setModalOpen(true)
  }

  const openEdit = (record) => {
    setEditId(record.id)
    setForm({
      date: record.date,
      total_raw_stock: record.total_raw_stock,
      raw_stock_used: record.raw_stock_used,
      remaining_raw_stock: record.remaining_raw_stock,
      fabric_produced: record.fabric_produced
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...form,
        total_raw_stock: parseFloat(form.total_raw_stock),
        raw_stock_used: parseFloat(form.raw_stock_used),
        fabric_produced: parseFloat(form.fabric_produced)
      }
      
      // Calculate remaining raw stock
      payload.remaining_raw_stock = payload.total_raw_stock - payload.raw_stock_used
      
      if (editId) {
        await dailyUsageAPI.update(editId, payload)
      } else {
        await dailyUsageAPI.create(payload)
      }
      
      setModalOpen(false)
      loadRecords()
    } catch (err) {
      alert(err.response?.data?.message || err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this stock record?')) return
    try {
      await dailyUsageAPI.delete(id)
      loadRecords()
    } catch (err) {
      alert(err.response?.data?.message || err.message)
    }
  }

  const handleRawStockSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        total_raw_stock: parseFloat(rawStockForm.total_raw_stock)
      }
      
      await dailyUsageAPI.updateRawStock(payload)
      setShowRawStockModal(false)
      loadRecords()
    } catch (err) {
      alert(err.response?.data?.message || err.message)
    }
  }

  // Auto-calculate remaining stock when raw stock values change
  useEffect(() => {
    const total = parseFloat(form.total_raw_stock) || 0
    const used = parseFloat(form.raw_stock_used) || 0
    const remaining = total - used
    setForm(prev => ({ ...prev, remaining_raw_stock: remaining >= 0 ? remaining : 0 }))
  }, [form.total_raw_stock, form.raw_stock_used])

  // Production validation based on 90% output rule
  useEffect(() => {
    const rawUsed = parseFloat(form.raw_stock_used) || 0
    const fabricProduced = parseFloat(form.fabric_produced) || 0
    const expectedFabric = rawUsed * 0.9
    
    // Show warning if actual fabric produced is less than 90% of raw stock used
    if (rawUsed > 0 && fabricProduced > 0 && fabricProduced < expectedFabric) {
      setProductionWarning(true)
    } else {
      setProductionWarning(false)
    }
  }, [form.raw_stock_used, form.fabric_produced])

  const getExpectedFabric = () => {
    const rawUsed = parseFloat(form.raw_stock_used) || 0
    return (rawUsed * 0.9).toFixed(2)
  }

  const filteredRecords = records.filter(record => 
    record.date.toLowerCase().includes(search.toLowerCase()) ||
    record.notes?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Daily Stock Management</h1>
          <p className="text-slate-500 mt-1">Track raw material and fabric production</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRawStockModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Package size={20} />
            Raw Stock
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <BarChart3 size={20} />
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-950 text-white hover:bg-navy-800">
            <Plus size={20} />
            Add Stock Entry
          </button>
        </div>
      </div>

      {/* Current Raw Stock */}
      {rawStock && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-indigo-900">Total Raw Stock</h3>
              <p className="text-3xl font-bold text-indigo-600 mt-2">{rawStock.total_raw_stock} kg</p>
            </div>
            <button
              onClick={() => setShowRawStockModal(true)}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Update Stock
            </button>
          </div>
        </motion.div>
      )}

      {/* Stock History */}
      {showHistory && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white rounded-xl shadow-card border border-slate-100 overflow-hidden"
        >
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-semibold text-navy-900 flex items-center gap-2">
              <TrendingDown size={20} />
              Stock History
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Date</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Total Raw Stock</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Raw Stock Used</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Remaining Raw Stock</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Fabric Produced</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Production Status</th>
                </tr>
              </thead>
              <tbody>
                {reductionHistory.map((record) => {
                  const expectedFabric = (record.raw_stock_used * 0.9).toFixed(2)
                  const hasProductionWarning = record.fabric_produced < expectedFabric
                  
                  return (
                  <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium text-navy-900">{record.date}</td>
                    <td className="px-6 py-4 text-slate-600">{record.total_raw_stock} kg</td>
                    <td className="px-6 py-4 font-semibold text-indigo-600">{record.raw_stock_used} kg</td>
                    <td className="px-6 py-4 font-semibold text-emerald-600">{record.remaining_raw_stock} kg</td>
                    <td className="px-6 py-4 font-semibold text-purple-600">{record.fabric_produced} kg</td>
                    <td className="px-6 py-4">
                      {hasProductionWarning ? (
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle size={16} />
                          Below Expected
                        </span>
                      ) : (
                        <span className="text-emerald-600">On Target</span>
                      )}
                    </td>
                  </tr>
                  )
                })}
                {reductionHistory.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                      No history records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Daily Stock Records */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-card border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-navy-900 flex items-center gap-2">
            <Calendar size={20} />
            Daily Stock Entries
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search records..."
              className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>
        
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading stock records...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Date</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Total Raw Stock</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Raw Stock Used</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Remaining Raw Stock</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Fabric Produced</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Production Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => {
                  const expectedFabric = (record.raw_stock_used * 0.9).toFixed(2)
                  const hasProductionWarning = record.fabric_produced < expectedFabric
                  
                  return (
                  <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium text-navy-900">{record.date}</td>
                    <td className="px-6 py-4 text-slate-600">{record.total_raw_stock} kg</td>
                    <td className="px-6 py-4 font-semibold text-indigo-600">{record.raw_stock_used} kg</td>
                    <td className="px-6 py-4 font-semibold text-emerald-600">{record.remaining_raw_stock} kg</td>
                    <td className="px-6 py-4 font-semibold text-purple-600">{record.fabric_produced} kg</td>
                    <td className="px-6 py-4">
                      {hasProductionWarning ? (
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle size={16} />
                          Below Expected
                        </span>
                      ) : (
                        <span className="text-emerald-600">On Target</span>
                      )}
                    </td>
                    <td className="px-6 py-4 flex gap-2">
                      <button onClick={() => openEdit(record)} className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600">
                        <Pencil size={18} />
                      </button>
                      <button onClick={() => handleDelete(record.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                  )
                })}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-slate-500">
                      No stock records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Stock Entry' : 'Add Stock Entry'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Total Raw Stock (kg) *</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form.total_raw_stock}
                onChange={(e) => setForm({ ...form, total_raw_stock: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Raw Stock Used (kg) *</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form.raw_stock_used}
                onChange={(e) => setForm({ ...form, raw_stock_used: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Remaining Raw Stock (kg)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form.remaining_raw_stock}
                readOnly
                className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-600"
                placeholder="Auto-calculated"
              />
              <p className="text-xs text-slate-500 mt-1">Automatically calculated: Total Raw Stock - Raw Stock Used</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fabric Produced (kg) *</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form.fabric_produced}
                onChange={(e) => setForm({ ...form, fabric_produced: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
          </div>
          
          {/* Production Validation Display */}
          {form.raw_stock_used && (
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Production Analysis</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-600">Raw Stock Used:</p>
                  <p className="font-semibold text-indigo-600">{form.raw_stock_used} kg</p>
                </div>
                <div>
                  <p className="text-slate-600">Expected Fabric (90%):</p>
                  <p className="font-semibold text-emerald-600">{getExpectedFabric()} kg</p>
                </div>
                <div>
                  <p className="text-slate-600">Actual Fabric:</p>
                  <p className="font-semibold text-purple-600">{form.fabric_produced || '0'} kg</p>
                </div>
              </div>
              
              {/* Warning Message */}
              {productionWarning && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    ⚠️ Warning: Fabric produced is below the expected output for the raw stock used.
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Expected: {getExpectedFabric()} kg, Actual: {form.fabric_produced} kg
                  </p>
                </div>
              )}
            </div>
          )}
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

      {/* Raw Stock Modal */}
      <Modal open={showRawStockModal} onClose={() => setShowRawStockModal(false)} title="Update Raw Stock">
        <form onSubmit={handleRawStockSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Total Raw Stock (kg) *</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={rawStockForm.total_raw_stock}
              onChange={(e) => setRawStockForm({ total_raw_stock: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Enter total raw stock available..."
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowRawStockModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-navy-950 text-white hover:bg-navy-800">
              Update Stock
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
