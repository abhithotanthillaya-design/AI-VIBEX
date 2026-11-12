import { useState } from 'react'
import { AlertTriangle, Clock, Minus, Plus, Utensils } from 'lucide-react'
import type { MenuItem } from '../types'
import { formatRupees } from '../utils/format'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { VegBadge } from './ui/VegBadge'

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
    <Card
      className={`group flex flex-col overflow-hidden transition-all duration-200 ${
        item.available
          ? 'hover:-translate-y-0.5 hover:border-[#C7BFA9] hover:shadow-md'
          : 'opacity-80'
      }`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#EFEAE0]">
        {item.image_url && !imageFailed ? (
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#EFEAE0] text-[#787166]">
            <Utensils className="h-8 w-8" aria-hidden="true" />
          </div>
        )}

        <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
          <span className="rounded-full border border-[#E4DED2]/80 bg-[#FCFBF8]/95 px-2.5 py-1 text-[11px] font-medium text-[#1E1D1A] shadow-xs backdrop-blur-xs">
            {item.category}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#1E1D1A]/85 px-2.5 py-1 text-[11px] font-medium text-[#FCFBF8] backdrop-blur-xs tabular-nums">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span>{item.prep_minutes}m prep</span>
          </span>
        </div>

        {!item.available && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1E1D1A]/50 backdrop-blur-[1px]">
            <span className="rounded-full border border-[#E7BDBD] bg-[#FCFBF8] px-3 py-1 text-xs font-semibold text-[#842323]">
              Sold Out
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-semibold leading-snug text-[#1E1D1A]">
              {item.name}
            </h3>
            <VegBadge isVeg={item.is_veg} showLabel />
          </div>

          {(item.is_vegan || item.is_jain) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {item.is_vegan && <Badge tone="forest">Vegan</Badge>}
              {item.is_jain && <Badge tone="saffron">Jain-Friendly</Badge>}
            </div>
          )}

          <p className="text-sm leading-relaxed text-[#5B564D]">
            {item.description}
          </p>

          <p className="flex items-start gap-1.5 rounded-xl border border-[#E4DED2] bg-[#F7F4ED] px-2.5 py-1.5 text-[11px] leading-snug text-[#5B564D]">
            <AlertTriangle
              className="mt-0.5 h-3 w-3 shrink-0 text-[#A87122]"
              aria-hidden="true"
            />
            <span>
              <strong className="text-[#1E1D1A]">Allergens:</strong>{' '}
              {item.allergen_info
                ? item.allergen_info
                : 'Not listed — confirm ingredients at counter'}
            </span>
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#E4DED2] pt-3">
          <span className="text-base font-semibold text-[#1E1D1A] tabular-nums">
            {formatRupees(item.price)}
          </span>

          {quantity === 0 ? (
            <Button
              size="sm"
              variant="primary"
              disabled={!item.available}
              onClick={() => onAdd(item)}
              icon={<Plus className="h-4 w-4" aria-hidden="true" />}
              aria-label={`Add ${item.name} to cart`}
            >
              {item.available ? 'Add' : 'Unavailable'}
            </Button>
          ) : (
            <div
              className="inline-flex items-center rounded-xl border border-[#BDD6C7] bg-[#E3EFE8] p-0.5"
              role="group"
              aria-label={`Quantity controls for ${item.name}`}
            >
              <button
                type="button"
                onClick={() => onUpdateQuantity(item.id, -1)}
                aria-label={`Decrease quantity of ${item.name}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#143B2B] transition-colors hover:bg-[#FCFBF8] cursor-pointer"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="min-w-7 text-center text-sm font-semibold text-[#143B2B] tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => onUpdateQuantity(item.id, 1)}
                aria-label={`Increase quantity of ${item.name}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#143B2B] transition-colors hover:bg-[#FCFBF8] cursor-pointer"
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
