import axios from 'axios'

const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api'

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Auth
export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
}

// Work Types
export const workTypeAPI = {
  getAll: (params) => api.get('/work-types', { params }),
  get: (id) => api.get(`/work-types/${id}`),
  create: (data) => api.post('/work-types', data),
  update: (id, data) => api.put(`/work-types/${id}`, data),
  delete: (id) => api.delete(`/work-types/${id}`),
}

// Workers
export const workerAPI = {
  getAll: (params) => api.get('/workers', { params }),
  get: (id) => api.get(`/workers/${id}`),
  create: (data) => api.post('/workers', data),
  update: (id, data) => api.put(`/workers/${id}`, data),
  delete: (id) => api.delete(`/workers/${id}`),
}

// Fabrics
export const fabricAPI = {
  getAll: (params) => api.get('/fabrics', { params }),
  get: (id) => api.get(`/fabrics/${id}`),
  create: (data) => api.post('/fabrics', data),
  update: (id, data) => api.put(`/fabrics/${id}`, data),
  delete: (id) => api.delete(`/fabrics/${id}`),
}

// Attendance
export const attendanceAPI = {
  getAll: (params) => api.get('/attendance', { params }),
  mark: (data) => api.post('/attendance', data),
  bulk: (data) => api.post('/attendance/bulk', data),
  delete: (id) => api.delete(`/attendance/${id}`),
}

// Assignments
export const assignmentAPI = {
  getAll: (params) => api.get('/assignments', { params }),
  create: (data) => api.post('/assignments', data),
  update: (id, data) => api.put(`/assignments/${id}`, data),
  delete: (id) => api.delete(`/assignments/${id}`),
}

// Waste
export const wasteAPI = {
  getAll: (params) => api.get('/waste', { params }),
  getTrend: (params) => api.get('/waste/trend', { params }),
  create: (data) => api.post('/waste', data),
  delete: (id) => api.delete(`/waste/${id}`),
}

// Salary
export const salaryAPI = {
  getAll: (params) => api.get('/salary', { params }),
  calculate: (data) => api.post('/salary/calculate', data),
  getWeeklyPayroll: (params) => api.get('/salary/payroll/weekly', { params }),
  update: (id, data) => api.put(`/salary/${id}`, data),
}

// Weekly Wages
export const weeklyWageAPI = {
  getAll: (params) => api.get('/weekly-wages', { params }),
  create: (data) => api.post('/weekly-wages', data),
  update: (id, data) => api.put(`/weekly-wages/${id}`, data),
  delete: (id) => api.delete(`/weekly-wages/${id}`),
  calculate: (data) => api.post('/weekly-wages/calculate', data),
}

// Reports
export const reportAPI = {
  salary: (params) => api.get('/reports/salary', { params }),
  attendance: (params) => api.get('/reports/attendance', { params }),
  fabric: (params) => api.get('/reports/fabric', { params }),
  waste: (params) => api.get('/reports/waste', { params }),
  allocation: (params) => api.get('/reports/allocation', { params }),
  generate: (params) => api.get('/reports/generate', { params }),
  dashboard: () => api.get('/reports/dashboard'),
}

// Daily Usage / Stock Management
export const dailyUsageAPI = {
  getAll: (params) => api.get('/daily-usage', { params }),
  create: (data) => api.post('/daily-usage', data),
  update: (id, data) => api.put(`/daily-usage/${id}`, data),
  delete: (id) => api.delete(`/daily-usage/${id}`),
  getReductionHistory: (params) => api.get('/daily-usage/reduction-history', { params }),
  getWarnings: () => api.get('/daily-usage/warnings'),
  getRawStock: () => api.get('/daily-usage/raw-stock'),
  updateRawStock: (data) => api.post('/daily-usage/raw-stock', data),
}

// Attendance History
export const attendanceHistoryAPI = {
  getAll: (params) => api.get('/attendance-history', { params }),
  getSummary: (params) => api.get('/attendance-history/summary', { params }),
  getMonthly: (params) => api.get('/attendance-history/monthly', { params }),
}

// Operations
export const operationsAPI = {
  workAssign: (data) => api.post('/work/assign', data),
  wagesCalculate: (data) => api.post('/wages/calculate', data),
}
