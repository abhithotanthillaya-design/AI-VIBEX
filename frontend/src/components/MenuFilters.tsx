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
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search dishes, snacks, or drinks..."
          aria-label="Search menu items"
          className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-10 text-sm text-stone-900 placeholder:text-stone-400 shadow-2xs transition-colors focus:border-emerald-600 focus:outline-none"
        />
        {searchQuery.length > 0 && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear search query"
            className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer"
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
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
            selectedCategory === 'All'
              ? 'border-emerald-700 bg-emerald-700 text-white'
              : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
          }`}
        >
          <span>All</span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
              selectedCategory === 'All'
                ? 'bg-emerald-800 text-emerald-50'
                : 'bg-stone-100 text-stone-600'
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
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                isSelected
                  ? 'border-emerald-700 bg-emerald-700 text-white'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
              }`}
            >
              <span>{category}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  isSelected
                    ? 'bg-emerald-800 text-emerald-50'
                    : 'bg-stone-100 text-stone-600'
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
        <span className="mr-1 text-xs font-medium text-stone-500">Dietary:</span>
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
                  ? 'border-emerald-700 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-700'
                  : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
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

