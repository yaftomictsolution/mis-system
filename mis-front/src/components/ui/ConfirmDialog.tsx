'use client'

import { Modal } from './modal'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
}

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message }: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center mb-4 text-red-600 dark:text-red-400">
          <AlertTriangle size={24} />
        </div>
        <p className="text-slate-600 dark:text-slate-300 mb-8">{message}</p>
        <div className="flex gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-100 dark:bg-[#1a1a2e] text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-[#2a2a3e] transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium shadow-lg shadow-red-500/20"
          >
            Delete
          </button>
        </div>
      </div>
    </Modal>
  )
}
