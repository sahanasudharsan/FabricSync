import { createContext, useContext, useState, useEffect } from 'react'
import { attendanceAPI } from '../services/api'

const AttendanceContext = createContext()

export const useAttendance = () => {
  const context = useContext(AttendanceContext)
  if (!context) {
    throw new Error('useAttendance must be used within an AttendanceProvider')
  }
  return context
}

export const AttendanceProvider = ({ children }) => {
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  // Refresh attendance data
  const refreshAttendance = async (filters = {}) => {
    setLoading(true)
    try {
      const response = await attendanceAPI.getAll(filters)
      if (response.data.success) {
        setAttendanceRecords(response.data.data || [])
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error('Error refreshing attendance:', error)
    } finally {
      setLoading(false)
    }
  }

  // Mark attendance for single worker
  const markAttendance = async (data) => {
    try {
      const response = await attendanceAPI.mark(data)
      if (response.data.success) {
        // Immediately update local state
        setAttendanceRecords(prev => {
          const existing = prev.find(r => 
            r.worker_id === data.worker_id && r.date === data.date
          )
          if (existing) {
            return prev.map(r => 
              r.worker_id === data.worker_id && r.date === data.date 
                ? { ...response.data.data }
                : r
            )
          } else {
            return [...prev, response.data.data]
          }
        })
        setLastUpdated(new Date())
        return { success: true, data: response.data.data }
      }
      return { success: false, message: response.data.message }
    } catch (error) {
      console.error('Error marking attendance:', error)
      return { success: false, message: error.response?.data?.message || error.message }
    }
  }

  // Bulk mark attendance
  const bulkMarkAttendance = async (data) => {
    try {
      const response = await attendanceAPI.bulk(data)
      if (response.data.success) {
        // Refresh attendance data after bulk operation
        await refreshAttendance({ date: data.date })
        return { 
          success: true, 
          data: response.data,
          inserted: response.data.inserted || 0,
          updated: response.data.updated || 0,
          skipped: response.data.skipped || 0
        }
      }
      return { success: false, message: response.data.message }
    } catch (error) {
      console.error('Error bulk marking attendance:', error)
      return { success: false, message: error.response?.data?.message || error.message }
    }
  }

  // Delete attendance
  const deleteAttendance = async (id) => {
    try {
      const response = await attendanceAPI.delete(id)
      if (response.data.success) {
        setAttendanceRecords(prev => prev.filter(r => r.id !== id))
        setLastUpdated(new Date())
        return { success: true }
      }
      return { success: false, message: response.data.message }
    } catch (error) {
      console.error('Error deleting attendance:', error)
      return { success: false, message: error.response?.data?.message || error.message }
    }
  }

  // Get attendance for specific worker and date
  const getWorkerAttendance = (workerId, date) => {
    return attendanceRecords.find(r => 
      r.worker_id === workerId && r.date === date
    )
  }

  // Get attendance summary for a date
  const getAttendanceSummary = (date) => {
    const dayRecords = attendanceRecords.filter(r => r.date === date)
    return {
      total: dayRecords.length,
      present: dayRecords.filter(r => r.status === 'present').length,
      absent: dayRecords.filter(r => r.status === 'absent').length
    }
  }

  const value = {
    attendanceRecords,
    loading,
    lastUpdated,
    refreshAttendance,
    markAttendance,
    bulkMarkAttendance,
    deleteAttendance,
    getWorkerAttendance,
    getAttendanceSummary
  }

  return (
    <AttendanceContext.Provider value={value}>
      {children}
    </AttendanceContext.Provider>
  )
}
