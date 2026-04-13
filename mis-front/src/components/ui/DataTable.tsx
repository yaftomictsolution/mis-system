'use client'

import { Fragment, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Edit2, Trash2, Eye, ChevronLeft, ChevronRight, Search, Minus, Plus } from 'lucide-react'
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
  canDelete?: (item: T) => boolean
  onView?: (item: T) => void
  expandableRows?: boolean
  renderExpandedRow?: (item: T) => ReactNode
  mobileStack?: boolean
  searchable?: boolean
  searchKeys?: (keyof T | string)[]
  pageSize?: number
  loading?: boolean
  compact?: boolean
  noHorizontalScroll?: boolean
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onEdit,
  onDelete,
  canDelete,
  onView,
  expandableRows = false,
  renderExpandedRow,
  mobileStack = false,
  searchable = true,
  searchKeys,
  pageSize = 10,
  loading = false,
  compact = false,
  noHorizontalScroll = false,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
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

  const hasActions = Boolean(onEdit || onDelete || onView)
  const canExpand = Boolean(expandableRows && renderExpandedRow)
  const totalColumns = columns.length + (hasActions ? 1 : 0) + (canExpand ? 1 : 0)

  const toggleRow = (key: string): void => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const tableTextClass = compact ? 'text-xs' : 'text-sm'
  const headerCellClass = compact ? 'px-3 py-3' : 'px-6 py-4'
  const bodyCellClass = compact ? 'px-3 py-3' : 'px-6 py-4'
  const actionsCellClass = compact ? 'px-3 py-3 text-right' : 'px-6 py-4 text-right'
  const expandCellClass = compact ? 'w-10 px-2 py-3 text-center' : 'w-12 px-3 py-4 text-center'
  const whiteSpaceClass = noHorizontalScroll ? 'whitespace-normal break-words' : 'whitespace-nowrap'
  const overflowClass = noHorizontalScroll ? '' : 'overflow-x-auto'
  const tableLayoutClass = noHorizontalScroll ? 'table-fixed' : ''
  const theadClass = mobileStack
    ? 'hidden md:table-header-group bg-slate-50 dark:bg-[#0a0a0f] text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs font-semibold'
    : 'bg-slate-50 dark:bg-[#0a0a0f] text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs font-semibold'
  const tbodyClass = mobileStack
    ? 'block divide-y divide-slate-200 dark:divide-[#2a2a3e] md:table-row-group'
    : 'divide-y divide-slate-200 dark:divide-[#2a2a3e]'
  const rowClass = mobileStack
    ? 'group mb-3 block rounded-xl border border-slate-200 bg-white p-2 hover:bg-slate-50 transition-colors dark:border-[#2a2a3e] dark:bg-[#12121a] dark:hover:bg-[#1a1a2e] md:mb-0 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:table-row'
    : 'hover:bg-slate-50 dark:hover:bg-[#1a1a2e] transition-colors group'
  const expandCellMobileClass = mobileStack
    ? 'block border-b border-slate-100 dark:border-[#2a2a3e] md:table-cell md:border-0'
    : ''
  const bodyCellMobileClass = mobileStack
    ? 'block border-b border-slate-100 dark:border-[#2a2a3e] md:table-cell md:border-0'
    : ''
  const actionsCellMobileClass = mobileStack
    ? 'block border-b-0 md:table-cell'
    : ''

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
      {loading && (
        <div className="h-1 w-full overflow-hidden bg-slate-200 dark:bg-[#1a1a2e]">
          <motion.div
            className="h-full w-1/3 rounded-full bg-blue-600 dark:bg-blue-500"
            animate={{ x: ["-120%", "320%"] }}
            transition={{ duration: 1, ease: "linear", repeat: Infinity }}
          />
        </div>
      )}
      <div className={overflowClass}>
        <table className={`w-full text-left ${tableTextClass} ${tableLayoutClass}`}>
          <thead className={theadClass}>
            <tr>
              {canExpand && <th className={expandCellClass}> </th>}
              {columns.map((col, idx) => (
                <th key={idx} className={headerCellClass}>
                  {col.label}
                </th>
              ))}
              {hasActions && <th className={`${headerCellClass} text-right`}>Actions</th>}
            </tr>
          </thead>
          <tbody className={tbodyClass}>
            <AnimatePresence mode="popLayout">
              {paginatedData.map((item, idx) => {
                const key = rowKey(item, idx)
                const isExpanded = expandedRows.has(key)

                return (
                  <Fragment key={key}>
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      layout
                      className={rowClass}
                    >
                      {canExpand && (
                        <td className={`${expandCellClass} ${expandCellMobileClass}`}>
                          <div className={mobileStack ? 'flex items-center justify-between gap-3 md:block' : ''}>
                            {mobileStack && (
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:hidden">
                                Details
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleRow(key)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 dark:border-[#2a2a3e] dark:text-slate-300 dark:hover:bg-[#1a1a2e]"
                              title={isExpanded ? 'Collapse row' : 'Expand row'}
                            >
                              {isExpanded ? <Minus size={14} /> : <Plus size={14} />}
                            </button>
                          </div>
                        </td>
                      )}
                      {columns.map((col, colIdx) => (
                        <td key={colIdx} className={`${bodyCellClass} ${bodyCellMobileClass} text-slate-700 dark:text-slate-300 ${whiteSpaceClass}`}>
                          {mobileStack ? (
                            <div className="flex items-start justify-between gap-3 md:block">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:hidden">
                                {col.label}
                              </span>
                              <div className="min-w-0 text-right md:text-left">
                                {col.render ? col.render(item) : String(item[col.key as keyof T])}
                              </div>
                            </div>
                          ) : (
                            col.render ? col.render(item) : String(item[col.key as keyof T])
                          )}
                        </td>
                      ))}
                      {hasActions && (
                        <td className={`${actionsCellClass} ${actionsCellMobileClass}`}>
                          <div className={mobileStack ? 'flex items-start justify-between gap-3 md:block' : ''}>
                            {mobileStack && (
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:hidden">
                                Actions
                              </span>
                            )}
                            <div className="flex items-center justify-end gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
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
                            {onDelete && (canDelete ? canDelete(item) : true) && (
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
                          </div>
                        </td>
                      )}
                    </motion.tr>
                    {canExpand && isExpanded && (
                      <tr className={`bg-slate-50/60 dark:bg-[#0f111a] ${mobileStack ? 'block rounded-xl border border-slate-200 dark:border-[#2a2a3e] md:rounded-none md:border-0 md:table-row' : ''}`}>
                        <td colSpan={totalColumns} className={`${compact ? 'px-3 py-3' : 'px-6 py-4'} ${mobileStack ? 'block md:table-cell' : ''}`}>
                          {renderExpandedRow?.(item)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </AnimatePresence>
            {!loading && paginatedData.length === 0 && (
              <tr className={mobileStack ? 'block md:table-row' : ''}>
                <td colSpan={totalColumns} className={`px-6 py-12 text-center text-slate-500 dark:text-slate-400 ${mobileStack ? 'block md:table-cell' : ''}`}>
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-slate-200 dark:border-[#2a2a3e] flex flex-col gap-3 bg-slate-50 dark:bg-[#0a0a0f] sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {loading
            ? "Loading data..."
            : `Showing ${Math.min((safeCurrentPage - 1) * itemsPerPage + 1, filteredData.length)} to ${Math.min(
                safeCurrentPage * itemsPerPage,
                filteredData.length
              )} of ${filteredData.length} entries`}
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
