interface VegBadgeProps {
  isVeg: boolean
  showLabel?: boolean
}

export function VegBadge({ isVeg, showLabel = false }: VegBadgeProps) {
  const label = isVeg ? 'Vegetarian' : 'Non-Vegetarian'
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={label}
      aria-label={label}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border ${
          isVeg ? 'border-emerald-700' : 'border-rose-700'
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            isVeg ? 'bg-emerald-700' : 'bg-rose-700'
          }`}
        />
      </span>
      {showLabel && (
        <span className="text-xs font-medium text-stone-700">
          {isVeg ? 'Veg' : 'Non-Veg'}
        </span>
      )}
    </span>
  )
}

