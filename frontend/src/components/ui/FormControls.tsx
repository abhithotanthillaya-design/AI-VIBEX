import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

interface FormFieldProps {
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: string | null
  children: ReactNode
}

export function FormField({
  id,
  label,
  required = false,
  hint,
  error,
  children,
}: FormFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-[#3F3B34]"
      >
        {label}{' '}
        {required && (
          <span className="text-[#9F2D2D]" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p className="mt-1 text-xs text-[#9F2D2D]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-[#787166]">{hint}</p>
      ) : null}
    </div>
  )
}

const INPUT_BASE_CLASS =
  'w-full rounded-xl border border-[#D8D0C1] bg-[#FCFBF8] px-3 py-2 text-sm text-[#1E1D1A] placeholder:text-[#8E867B] transition-colors focus:border-[#1A4D38] focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:bg-[#EFEAE0]/70 disabled:text-[#787166]'

export function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${INPUT_BASE_CLASS} ${className}`} {...props} />
}

export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${INPUT_BASE_CLASS} ${className}`} {...props} />
}

export function Select({
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${INPUT_BASE_CLASS} ${className}`} {...props}>
      {children}
    </select>
  )
}

