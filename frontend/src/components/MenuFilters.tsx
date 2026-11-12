import { Search, X } from 'lucide-react'
import type { DietaryFilter } from '../types'
import { DIETARY_FILTER_OPTIONS } from '../utils/phase10'

interface MenuFiltersProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  categories: string[]
  selectedCategory: string
  onCategoryChange: (category: string) => void
  dietaryFilter: DietaryFilter
  onDietaryChange: (dietary: DietaryFilter) => void
  categoryCounts: Record<string, number>
  totalCount: number
}

export function MenuFilters({
  searchQuery,
  onSearchChange,
  categories,
  selectedCategory,
  onCategoryChange,
  dietaryFilter,
  onDietaryChange,
  categoryCounts,
  totalCount,
}: MenuFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#787166]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search dishes, snacks, or drinks..."
          aria-label="Search menu items"
          className="w-full rounded-xl border border-[#D8D0C1] bg-[#FCFBF8] py-2.5 pl-10 pr-10 text-sm text-[#1E1D1A] placeholder:text-[#8E867B] shadow-2xs transition-colors focus:border-[#1A4D38] focus:bg-white focus:outline-none"
        />
        {searchQuery.length > 0 && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear search query"
            className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#787166] hover:bg-[#EFEAE0] hover:text-[#1E1D1A] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div
        className="flex flex-wrap items-center gap-2"
        role="tablist"
        aria-label="Menu categories"
      >
        <button
          type="button"
          role="tab"
          aria-selected={selectedCategory === 'All'}
          onClick={() => onCategoryChange('All')}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-150 cursor-pointer ${
            selectedCategory === 'All'
              ? 'border-[#1A4D38] bg-[#1A4D38] text-[#FCFBF8] shadow-xs'
              : 'border-[#D8D0C1] bg-[#FCFBF8] text-[#5B564D] hover:border-[#C2B8A6] hover:bg-[#EFEAE0]/60 hover:text-[#1E1D1A]'
          }`}
        >
          <span>All</span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
              selectedCategory === 'All'
                ? 'bg-[#143B2B] text-[#E3EFE8]'
                : 'bg-[#EFEAE0] text-[#5B564D]'
            }`}
          >
            {totalCount}
          </span>
        </button>

        {categories.map((category) => {
          const isSelected = selectedCategory === category
          const count = categoryCounts[category] ?? 0
          return (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onCategoryChange(category)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-150 cursor-pointer ${
                isSelected
                  ? 'border-[#1A4D38] bg-[#1A4D38] text-[#FCFBF8] shadow-xs'
                  : 'border-[#D8D0C1] bg-[#FCFBF8] text-[#5B564D] hover:border-[#C2B8A6] hover:bg-[#EFEAE0]/60 hover:text-[#1E1D1A]'
              }`}
            >
              <span>{category}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                  isSelected
                    ? 'bg-[#143B2B] text-[#E3EFE8]'
                    : 'bg-[#EFEAE0] text-[#5B564D]'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Filter by dietary preference"
      >
        <span className="mr-1 text-xs font-medium text-[#5B564D]">Dietary:</span>
        {DIETARY_FILTER_OPTIONS.map((opt) => {
          const active = dietaryFilter === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => onDietaryChange(opt.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                active
                  ? 'border-[#1A4D38] bg-[#E3EFE8] text-[#143B2B]'
                  : 'border-[#D8D0C1] bg-[#FCFBF8] text-[#5B564D] hover:bg-[#EFEAE0]/60 hover:text-[#1E1D1A]'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
