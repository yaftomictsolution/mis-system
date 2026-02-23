'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Edit2, Trash2, Eye, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import type { ReactNode } from 'react'

export interface Column<T> {
  key: keyof T | string
  label: string
  render?: (item: T) => ReactNode
  sortable?: boolean
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[]
  data: T[]
  onEdit?: (item: T) => void
  onDelete?: (item: T) => void
  onView?: (item: T) => void
  searchable?: boolean
  searchKeys?: (keyof T | string)[]
  pageSize?: number
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onEdit,
  onDelete,
  onView,
  searchable = true,
  searchKeys,
  pageSize = 10,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = pageSize

  const filteredData = data.filter((item) => {
    if (!searchTerm || !searchKeys) return true
    return searchKeys.some((key) =>
      String(item[key as keyof T] ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage))
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages)
  const paginatedData = filteredData.slice(
    (safeCurrentPage - 1) * itemsPerPage,
    safeCurrentPage * itemsPerPage
  )

  const rowKey = (item: T, idx: number): string => {
    const id = item.id
    if (typeof id === 'string' || typeof id === 'number') {
      return String(id)
    }

    const uuid = item.uuid
    if (typeof uuid === 'string' || typeof uuid === 'number') {
      return String(uuid)
    }

    return `row-${idx}`
  }

  return (
    <div className="bg-white dark:bg-[#12121a] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2a3e] overflow-hidden">
      {searchable && (
        <div className="p-4 border-b border-slate-200 dark:border-[#2a2a3e]">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#0a0a0f] border border-slate-200 dark:border-[#2a2a3e] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-[#0a0a0f] text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs font-semibold">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className="px-6 py-4">
                  {col.label}
                </th>
              ))}
              {(onEdit || onDelete || onView) && <th className="px-6 py-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-[#2a2a3e]">
            <AnimatePresence mode="popLayout">
              {paginatedData.map((item, idx) => (
                <motion.tr
                  key={rowKey(item, idx)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  layout
                  className="hover:bg-slate-50 dark:hover:bg-[#1a1a2e] transition-colors group"
                >
                  {columns.map((col, idx) => (
                    <td key={idx} className="px-6 py-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {col.render ? col.render(item) : String(item[col.key as keyof T])}
                    </td>
                  ))}
                  {(onEdit || onDelete || onView) && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onView && (
                          <button
                            type="button"
                            onClick={() => onView(item)}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="View"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(item)}
                            className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(item)}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </motion.tr>
              ))}
            </AnimatePresence>
            {paginatedData.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-slate-200 dark:border-[#2a2a3e] flex items-center justify-between bg-slate-50 dark:bg-[#0a0a0f]">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          Showing {Math.min((safeCurrentPage - 1) * itemsPerPage + 1, filteredData.length)} to{' '}
          {Math.min(safeCurrentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safeCurrentPage === 1}
            className="p-2 rounded-lg border border-slate-200 dark:border-[#2a2a3e] text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-[#1a1a2e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safeCurrentPage >= totalPages}
            className="p-2 rounded-lg border border-slate-200 dark:border-[#2a2a3e] text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-[#1a1a2e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
