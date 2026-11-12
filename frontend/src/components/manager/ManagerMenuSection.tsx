import { useMemo, useState } from 'react'
import { Edit2, Plus, Search, Trash2, Utensils } from 'lucide-react'
import type { MenuItem } from '../../types'
import { formatRupees } from '../../utils/format'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { VegBadge } from '../ui/VegBadge'

interface ManagerMenuSectionProps {
  items: MenuItem[]
  isLoading: boolean
  togglingItemIds: Record<string, boolean>
  onOpenAddModal: () => void
  onOpenEditModal: (item: MenuItem) => void
  onToggleAvailability: (item: MenuItem) => void
  onRequestDelete: (item: MenuItem) => void
}

export function ManagerMenuSection({
  items,
  isLoading,
  togglingItemIds,
  onOpenAddModal,
  onOpenEditModal,
  onToggleAvailability,
  onRequestDelete,
}: ManagerMenuSectionProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')

  const categories = useMemo(() => {
    const set = new Set(items.map((item) => item.category))
    return ['All', ...Array.from(set).sort()]
  }, [items])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter((item) => {
      if (categoryFilter !== 'All' && item.category !== categoryFilter) {
        return false
      }
      if (!query) return true
      return (
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
      )
    })
  }, [items, search, categoryFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search menu items..."
              aria-label="Search manager menu"
              className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            aria-label="Filter manager menu by category"
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:border-emerald-600 focus:outline-none"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'All' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={onOpenAddModal}
          icon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          Add Menu Item
        </Button>
      </div>

      {isLoading && items.length === 0 ? (
        <Card className="space-y-3 p-5" aria-busy="true">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-14 animate-pulse rounded-xl bg-stone-100" />
          ))}
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
            <Utensils className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-stone-900">
            No matching menu items
          </h3>
          <p className="mt-1 text-sm text-stone-600">
            Add a new dish or adjust your search and category filter.
          </p>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-stone-200 bg-stone-50/80 text-xs font-semibold uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-4 py-3">Dish</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Prep</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filtered.map((item) => {
                    const isToggling = Boolean(togglingItemIds[item.id])
                    return (
                      <tr key={item.id} className="hover:bg-stone-50/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="h-10 w-12 rounded-lg object-cover bg-stone-100"
                              />
                            ) : (
                              <div className="flex h-10 w-12 items-center justify-center rounded-lg bg-stone-100 text-stone-400">
                                <Utensils className="h-4 w-4" aria-hidden="true" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <VegBadge isVeg={item.is_veg} />
                                <span className="font-semibold text-stone-900">
                                  {item.name}
                                </span>
                                {item.is_vegan && (
                                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 border border-emerald-200">
                                    Vegan
                                  </span>
                                )}
                                {item.is_jain && (
                                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 border border-amber-200">
                                    Jain
                                  </span>
                                )}
                              </div>
                              <p className="max-w-xs truncate text-xs text-stone-500">
                                {item.description}
                              </p>
                              <p className="max-w-xs truncate text-[11px] text-stone-500">
                                Allergens: {item.allergen_info ?? 'Not listed'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-stone-700">
                          {item.category}
                        </td>
                        <td className="px-4 py-3 font-medium text-stone-900">
                          {formatRupees(item.price)}
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {item.prep_minutes} min
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => onToggleAvailability(item)}
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                              item.available
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                : 'border-stone-300 bg-stone-100 text-stone-700 hover:bg-stone-200'
                            }`}
                          >
                            {isToggling
                              ? 'Updating...'
                              : item.available
                                ? 'Available'
                                : 'Sold Out'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => onOpenEditModal(item)}
                              aria-label={`Edit ${item.name}`}
                              icon={<Edit2 className="h-3.5 w-3.5" aria-hidden="true" />}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onRequestDelete(item)}
                              aria-label={`Delete ${item.name}`}
                              className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                              icon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((item) => {
              const isToggling = Boolean(togglingItemIds[item.id])
              return (
                <Card key={item.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <VegBadge isVeg={item.is_veg} />
                        <h3 className="font-semibold text-stone-900">
                          {item.name}
                        </h3>
                      </div>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {item.category} · {formatRupees(item.price)} ·{' '}
                        {item.prep_minutes} min
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => onToggleAvailability(item)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium cursor-pointer ${
                        item.available
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-stone-300 bg-stone-100 text-stone-700'
                      }`}
                    >
                      {item.available ? 'Available' : 'Sold Out'}
                    </button>
                  </div>

                  <p className="text-xs text-stone-600">{item.description}</p>
                  <p className="text-[11px] text-stone-500">
                    Allergens: {item.allergen_info ?? 'Not listed'}
                    {item.is_vegan ? ' · Vegan' : ''}
                    {item.is_jain ? ' · Jain-Friendly' : ''}
                  </p>

                  <div className="flex items-center justify-end gap-2 border-t border-stone-100 pt-2.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onOpenEditModal(item)}
                      icon={<Edit2 className="h-3.5 w-3.5" aria-hidden="true" />}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRequestDelete(item)}
                      className="text-rose-700 hover:bg-rose-50"
                      icon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                    >
                      Delete
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

