import { useState } from 'react'
import { Clock, Minus, Plus, Utensils } from 'lucide-react'
import type { MenuItem } from '../types'
import { formatRupees } from '../utils/format'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

interface MenuCardProps {
  item: MenuItem
  quantity: number
  onAdd: (item: MenuItem) => void
  onUpdateQuantity: (itemId: string, delta: number) => void
}

export function MenuCard({
  item,
  quantity,
  onAdd,
  onUpdateQuantity,
}: MenuCardProps) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <Card className="group flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-sm">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
        {item.image_url && !imageFailed ? (
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-stone-100 text-stone-400">
            <Utensils className="h-8 w-8" aria-hidden="true" />
          </div>
        )}

        <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-stone-800 shadow-xs backdrop-blur-xs">
            {item.category}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-stone-900/85 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-xs">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span>{item.prep_minutes} min prep</span>
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <h3 className="text-base font-semibold leading-snug text-stone-900">
            {item.name}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-stone-600">
            {item.description}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
          <div>
            <span className="text-base font-semibold text-stone-900">
              {formatRupees(item.price)}
            </span>
          </div>

          {quantity === 0 ? (
            <Button
              size="sm"
              variant="primary"
              disabled={!item.available}
              onClick={() => onAdd(item)}
              icon={<Plus className="h-4 w-4" aria-hidden="true" />}
              aria-label={`Add ${item.name} to cart`}
            >
              Add
            </Button>
          ) : (
            <div
              className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50/70 p-0.5"
              role="group"
              aria-label={`Quantity controls for ${item.name}`}
            >
              <button
                type="button"
                onClick={() => onUpdateQuantity(item.id, -1)}
                aria-label={`Decrease quantity of ${item.name}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-800 transition-colors hover:bg-emerald-100 cursor-pointer"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="min-w-7 text-center text-sm font-semibold text-emerald-950">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => onUpdateQuantity(item.id, 1)}
                aria-label={`Increase quantity of ${item.name}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-800 transition-colors hover:bg-emerald-100 cursor-pointer"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

