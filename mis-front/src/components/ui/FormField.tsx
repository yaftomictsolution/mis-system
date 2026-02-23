'use client'

interface Option {
  value: string | number
  label: string
}

interface FormFieldProps {
  label: string
  type?: 'text' | 'email' | 'number' | 'select' | 'textarea' | 'date'
  value: string | number
  onChange: (value: string | number) => void
  error?: string
  options?: Option[]
  placeholder?: string
  required?: boolean
  rows?: number
}

const baseInputClasses =
  'w-full px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0a0a0f] border border-slate-200 dark:border-[#2a2a3e] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600'

export function FormField({
  label,
  type = 'text',
  value,
  onChange,
  error,
  options,
  placeholder,
  required,
  rows = 3,
}: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {type === 'select' ? (
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`${baseInputClasses} appearance-none cursor-pointer`}
          >
            <option value="" disabled>
              {placeholder || 'Select an option'}
            </option>
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      ) : type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={baseInputClasses}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
          placeholder={placeholder}
          className={baseInputClasses}
        />
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
