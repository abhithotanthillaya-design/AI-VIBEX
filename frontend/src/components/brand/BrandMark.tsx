interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg'
  inverted?: boolean
}

const SIZE_MAP = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-10 w-10 rounded-xl',
  lg: 'h-12 w-12 rounded-2xl',
}

export function BrandMark({ size = 'md', inverted = false }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center ${SIZE_MAP[size]} ${
        inverted
          ? 'bg-[#FCFBF8] text-[#1A4D38] shadow-xs'
          : 'bg-[#1A4D38] text-[#FCFBF8] shadow-xs'
      }`}
    >
      <svg
        viewBox="0 0 40 40"
        className={size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-7 w-7' : 'h-6 w-6'}
        fill="none"
      >
        <circle
          cx="19"
          cy="19"
          r="9.5"
          stroke="currentColor"
          strokeWidth="3.2"
        />
        <path
          d="M21.5 21.5L28 28"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <circle cx="30" cy="11" r="3" fill="#C25E3A" />
      </svg>
    </span>
  )
}

interface BrandWordmarkProps {
  inverted?: boolean
  showTagline?: boolean
}

export function BrandWordmark({
  inverted = false,
  showTagline = false,
}: BrandWordmarkProps) {
  return (
    <span className="inline-flex flex-col leading-none">
      <span
        className={`text-base font-bold tracking-[0.14em] ${
          inverted ? 'text-[#FCFBF8]' : 'text-[#1E1D1A]'
        }`}
      >
        QUEUELESS
      </span>
      {showTagline && (
        <span
          className={`mt-1 text-[11px] font-medium tracking-wide ${
            inverted ? 'text-[#E3EFE8]/85' : 'text-[#5B564D]'
          }`}
        >
          Skip the queue. Not your meal.
        </span>
      )}
    </span>
  )
}

