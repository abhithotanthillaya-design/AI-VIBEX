import { useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, X } from 'lucide-react'
import type { MenuCategory, MenuItem, MenuItemUpsertRequest } from '../../types'
import {
  LOCAL_MENU_IMAGE_OPTIONS,
  MENU_CATEGORIES,
  validateMenuFormInput,
} from '../../utils/manager'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

interface MenuItemFormModalProps {
  open: boolean
  editingItem: MenuItem | null
  isSaving: boolean
  serverError: string | null
  onClose: () => void
  onSubmit: (payload: MenuItemUpsertRequest) => void
}

function buildInitialValues(item: MenuItem | null) {
  return {
    name: item?.name ?? '',
    description: item?.description ?? '',
    category: (MENU_CATEGORIES.includes(item?.category as MenuCategory)
      ? item?.category
      : 'Snacks') as MenuCategory,
    priceRupees: item ? String(item.price / 100) : '',
    prepMinutes: item ? String(item.prep_minutes) : '4',
    imageUrl: item?.image_url ?? '',
    isVeg: item?.is_veg ?? true,
    available: item?.available ?? true,
  }
}

export function MenuItemFormModal({
  open,
  editingItem,
  isSaving,
  serverError,
  onClose,
  onSubmit,
}: MenuItemFormModalProps) {
  const initial = buildInitialValues(editingItem)
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [category, setCategory] = useState<MenuCategory>(initial.category)
  const [priceRupees, setPriceRupees] = useState(initial.priceRupees)
  const [prepMinutes, setPrepMinutes] = useState(initial.prepMinutes)
  const [imageUrl, setImageUrl] = useState(initial.imageUrl)
  const [isVeg, setIsVeg] = useState(initial.isVeg)
  const [available, setAvailable] = useState(initial.available)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [open, isSaving, onClose])

  if (!open) {
    return null
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSaving) return

    const result = validateMenuFormInput({
      name,
      description,
      category,
      priceRupees,
      prepMinutes,
      imageUrl,
      isVeg,
      available,
    })

    if (!result.ok) {
      setValidationError(result.error)
      return
    }

    setValidationError(null)
    onSubmit(result.payload)
  }

  const displayedError = validationError ?? serverError

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="menu-form-title"
      onClick={() => {
        if (!isSaving) onClose()
      }}
    >
      <Card
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div>
            <h2
              id="menu-form-title"
              className="text-lg font-semibold text-stone-900"
            >
              {editingItem ? `Edit ${editingItem.name}` : 'Add New Menu Item'}
            </h2>
            <p className="text-xs text-stone-500">
              {editingItem
                ? 'Updates apply immediately to the live menu without changing historical orders.'
                : 'Prices are stored in paise on the backend.'}
            </p>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            aria-label="Close menu item form"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="menu-item-name"
              className="block text-xs font-medium text-stone-700"
            >
              Dish Name *
            </label>
            <input
              id="menu-item-name"
              type="text"
              required
              disabled={isSaving}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Paneer Butter Masala Bowl"
              maxLength={80}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="menu-item-desc"
              className="block text-xs font-medium text-stone-700"
            >
              Description *
            </label>
            <textarea
              id="menu-item-desc"
              rows={2}
              required
              disabled={isSaving}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Short appetizing description for students..."
              maxLength={300}
              className="mt-1 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="menu-item-category"
                className="block text-xs font-medium text-stone-700"
              >
                Category *
              </label>
              <select
                id="menu-item-category"
                disabled={isSaving}
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as MenuCategory)
                }
                className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
              >
                {MENU_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="menu-item-price"
                className="block text-xs font-medium text-stone-700"
              >
                Price (₹) *
              </label>
              <input
                id="menu-item-price"
                type="number"
                step="0.5"
                min="1"
                max="5000"
                required
                disabled={isSaving}
                value={priceRupees}
                onChange={(event) => setPriceRupees(event.target.value)}
                placeholder="65"
                className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="menu-item-prep"
                className="block text-xs font-medium text-stone-700"
              >
                Prep Time (min) *
              </label>
              <input
                id="menu-item-prep"
                type="number"
                step="1"
                min="1"
                max="60"
                required
                disabled={isSaving}
                value={prepMinutes}
                onChange={(event) => setPrepMinutes(event.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="menu-item-image"
              className="block text-xs font-medium text-stone-700"
            >
              Image Path or URL (optional)
            </label>
            <input
              id="menu-item-image"
              type="text"
              disabled={isSaving}
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="/images/menu/masala-dosa.jpg"
              maxLength={500}
              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
            />
            <div className="mt-1.5 flex items-center gap-2">
              <label
                htmlFor="menu-image-preset"
                className="text-[11px] text-stone-500"
              >
                Quick preset:
              </label>
              <select
                id="menu-image-preset"
                disabled={isSaving}
                value=""
                onChange={(event) => {
                  if (event.target.value) setImageUrl(event.target.value)
                }}
                className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] text-stone-700"
              >
                <option value="">Choose bundled photo...</option>
                {LOCAL_MENU_IMAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="block text-xs font-medium text-stone-700">
                Classification
              </span>
              <div className="mt-1 inline-flex w-full rounded-xl border border-stone-200 bg-stone-100/70 p-1">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsVeg(true)}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    isVeg
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-stone-600'
                  }`}
                >
                  Veg
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsVeg(false)}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    !isVeg
                      ? 'bg-white text-rose-800 shadow-xs'
                      : 'text-stone-600'
                  }`}
                >
                  Non-Veg
                </button>
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-stone-700">
                Availability
              </span>
              <div className="mt-1 inline-flex w-full rounded-xl border border-stone-200 bg-stone-100/70 p-1">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setAvailable(true)}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    available
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-stone-600'
                  }`}
                >
                  Available
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setAvailable(false)}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    !available
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600'
                  }`}
                >
                  Sold Out
                </button>
              </div>
            </div>
          </div>

          {displayedError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{displayedError}</span>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-stone-100 pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={isSaving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSaving}>
              {editingItem ? 'Save Changes' : 'Add Dish'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
