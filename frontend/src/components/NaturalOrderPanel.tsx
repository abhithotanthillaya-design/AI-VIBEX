import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit3,
  MessageSquareText,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { parseNaturalOrder } from '../api/client'
import type {
  AmbiguousOrderTerm,
  MenuItem,
  NaturalOrderParseResponse,
  ParsedOrderItem,
  ParsedPickupTime,
} from '../types'
import { formatRupees, formatTimeWindow } from '../utils/format'
import {
  calculatePreviewTotals,
  executeGuardedNaturalParse,
  NATURAL_ORDER_EXAMPLES,
  resolveAmbiguousCandidate,
  updatePreviewItemQuantity,
} from '../utils/naturalOrder'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { VegBadge } from './ui/VegBadge'

interface NaturalOrderPanelProps {
  menuItems: MenuItem[]
  onConfirmAddToCart: (
    additions: { item: MenuItem; quantity: number }[],
    preferredPickupTime?: ParsedPickupTime | null,
  ) => void
}

export function NaturalOrderPanel({
  menuItems,
  onConfirmAddToCart,
}: NaturalOrderPanelProps) {
  const [inputText, setInputText] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parseResult, setParseResult] =
    useState<NaturalOrderParseResponse | null>(null)
  const [previewItems, setPreviewItems] = useState<ParsedOrderItem[]>([])
  const [remainingAmbiguous, setRemainingAmbiguous] = useState<
    AmbiguousOrderTerm[]
  >([])
  const [addedNotice, setAddedNotice] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const parseInFlightRef = useRef(false)

  const runParse = async (textToParse: string) => {
    setParseError(null)
    setAddedNotice(null)
    setIsParsing(true)

    const outcome = await executeGuardedNaturalParse(
      textToParse,
      parseInFlightRef,
      parseNaturalOrder,
    )

    setIsParsing(false)

    if (outcome.status === 'empty_input' || outcome.status === 'error') {
      setParseError(outcome.message)
      return
    }
    if (outcome.status === 'ignored_duplicate') {
      return
    }

    setParseResult(outcome.result)
    setPreviewItems(outcome.result.matched_items)
    setRemainingAmbiguous(outcome.result.ambiguous_items)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void runParse(inputText)
  }

  const handleResolveCandidate = (
    term: AmbiguousOrderTerm,
    candidate: MenuItem,
  ) => {
    setPreviewItems((prev) =>
      resolveAmbiguousCandidate(prev, candidate, term.quantity, term.phrase),
    )
    setRemainingAmbiguous((prev) =>
      prev.filter((entry) => entry.phrase !== term.phrase),
    )
  }

  const handleConfirmAdd = () => {
    if (previewItems.length === 0) return

    const menuById = new Map(menuItems.map((m) => [m.id, m]))
    const additions: { item: MenuItem; quantity: number }[] = []

    for (const parsed of previewItems) {
      const liveItem = menuById.get(parsed.menu_item_id) ?? {
        id: parsed.menu_item_id,
        name: parsed.name,
        description: '',
        category: parsed.category,
        price: parsed.unit_price,
        prep_minutes: parsed.prep_minutes,
        available: parsed.available,
        is_veg: parsed.is_veg,
        image_url: null,
      }
      if (liveItem.available && parsed.quantity > 0) {
        additions.push({ item: liveItem, quantity: parsed.quantity })
      }
    }

    if (additions.length === 0) {
      setParseError('None of the selected items are currently available.')
      return
    }

    const preferredPickup = parseResult?.requested_pickup_time ?? null
    const totalAddedCount = additions.reduce(
      (sum, entry) => sum + entry.quantity,
      0,
    )
    onConfirmAddToCart(additions, preferredPickup)
    setParseResult(null)
    setPreviewItems([])
    setRemainingAmbiguous([])
    setInputText('')
    setAddedNotice(
      preferredPickup?.matched_slot_start
        ? `Added ${totalAddedCount} ${totalAddedCount === 1 ? 'item' : 'items'} and preselected your requested pickup window in Cart. Confirm and click Place Order to check out.`
        : `Added ${totalAddedCount} ${totalAddedCount === 1 ? 'item' : 'items'} to your cart. Confirm your pickup window in Cart and click Place Order.`,
    )
  }

  const handleEditRequest = () => {
    setParseResult(null)
    setPreviewItems([])
    setRemainingAmbiguous([])
    setParseError(null)
    window.setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
  }

  const handleCancelPreview = () => {
    setParseResult(null)
    setPreviewItems([])
    setRemainingAmbiguous([])
    setParseError(null)
  }

  const previewTotals = calculatePreviewTotals(previewItems)

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <MessageSquareText className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-stone-900">
              Order in your own words
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-stone-600">
              Type dishes, quantities, and an optional preferred pickup time.
              You will review and confirm items before anything is added to your
              cart.
            </p>
          </div>
        </div>
      </div>

      {addedNotice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900"
        >
          <span className="inline-flex items-center gap-2">
            <CheckCircle2
              className="h-4 w-4 shrink-0 text-emerald-700"
              aria-hidden="true"
            />
            <span>{addedNotice}</span>
          </span>
          <button
            type="button"
            onClick={() => setAddedNotice(null)}
            aria-label="Dismiss added notice"
            className="text-emerald-800 hover:text-emerald-950 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {!parseResult ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="natural-order-input" className="sr-only">
              Describe your order in plain language
            </label>
            <textarea
              ref={textareaRef}
              id="natural-order-input"
              rows={2}
              disabled={isParsing}
              value={inputText}
              maxLength={400}
              onChange={(event) => {
                setParseError(null)
                setAddedNotice(null)
                setInputText(event.target.value)
              }}
              placeholder="e.g. One masala dosa and two teas around 1:30 PM"
              className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none disabled:opacity-60"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-stone-500">
              Try:
            </span>
            {NATURAL_ORDER_EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                disabled={isParsing}
                onClick={() => {
                  setParseError(null)
                  setAddedNotice(null)
                  setInputText(example)
                }}
                className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] text-stone-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-900 cursor-pointer disabled:opacity-50"
              >
                {example}
              </button>
            ))}
          </div>

          {parseError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800"
            >
              <span className="inline-flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{parseError}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  void runParse(inputText)
                }}
                className="font-semibold underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-stone-500">
              Matches live canteen menu &amp; prices on the server
            </span>
            <div className="flex items-center gap-2">
              {inputText.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isParsing}
                  onClick={() => {
                    setInputText('')
                    setParseError(null)
                  }}
                >
                  Clear
                </Button>
              )}
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={isParsing}
                disabled={isParsing || inputText.trim().length === 0}
              >
                {isParsing ? 'Interpreting...' : 'Interpret Order'}
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <div className="space-y-4 rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Confirm Interpreted Items
              </p>
              <p className="mt-0.5 text-xs italic text-stone-600">
                &ldquo;{parseResult.original_text}&rdquo;
              </p>
            </div>
            <button
              type="button"
              onClick={handleEditRequest}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Edit Request</span>
            </button>
          </div>

          {parseResult.requested_pickup_time && (
            <div
              className={`rounded-xl border p-3 text-xs ${
                parseResult.requested_pickup_time.status === 'valid_note'
                  ? 'border-sky-200 bg-sky-50/70 text-sky-950'
                  : 'border-amber-200 bg-amber-50/80 text-amber-950'
              }`}
            >
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="space-y-1.5">
                  <p className="font-medium">
                    {parseResult.requested_pickup_time.message}
                  </p>
                  {parseResult.requested_pickup_time.suggested_slots.length >
                    0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold">Open slots:</span>
                      {parseResult.requested_pickup_time.suggested_slots.map(
                        (slot) => (
                          <span
                            key={slot.slot_start}
                            className="rounded-md border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-medium text-stone-800"
                          >
                            {formatTimeWindow(slot.slot_start, slot.slot_end)} (
                            {slot.remaining_units} units open)
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {previewItems.length > 0 ? (
            <ul className="divide-y divide-stone-200/70 rounded-xl border border-stone-200 bg-white px-3.5">
              {previewItems.map((item) => (
                <li
                  key={item.menu_item_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <VegBadge isVeg={item.is_veg} />
                      <span className="font-semibold text-stone-900">
                        {item.name}
                      </span>
                      <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-stone-600">
                        {item.match_type}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {formatRupees(item.unit_price)} each · matched &ldquo;
                      {item.matched_phrase}&rdquo;
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="inline-flex items-center rounded-lg border border-stone-200 bg-stone-50 p-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewItems((prev) =>
                            updatePreviewItemQuantity(
                              prev,
                              item.menu_item_id,
                              -1,
                            ),
                          )
                        }
                        aria-label={`Decrease preview quantity of ${item.name}`}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-stone-700 hover:bg-white cursor-pointer"
                      >
                        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <span className="min-w-6 text-center text-xs font-semibold text-stone-900">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewItems((prev) =>
                            updatePreviewItemQuantity(
                              prev,
                              item.menu_item_id,
                              1,
                            ),
                          )
                        }
                        aria-label={`Increase preview quantity of ${item.name}`}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-stone-700 hover:bg-white cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    <span className="min-w-14 text-right text-sm font-semibold text-stone-900">
                      {formatRupees(item.unit_price * item.quantity)}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setPreviewItems((prev) =>
                          prev.filter(
                            (entry) => entry.menu_item_id !== item.menu_item_id,
                          ),
                        )
                      }
                      aria-label={`Remove ${item.name} from preview`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-stone-200 bg-white p-4 text-center text-xs text-stone-600">
              No available items ready to add yet. Select a match below or edit
              your request.
            </div>
          )}

          {remainingAmbiguous.length > 0 && (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
              <p className="text-xs font-semibold text-amber-950">
                Select exact item to clarify:
              </p>
              {remainingAmbiguous.map((term) => (
                <div key={term.phrase} className="space-y-1.5">
                  <p className="text-xs text-amber-900">
                    For {term.quantity}× &ldquo;{term.phrase}&rdquo;:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {term.candidates.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        disabled={!candidate.available}
                        onClick={() => handleResolveCandidate(term, candidate)}
                        className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-900 hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-50 cursor-pointer"
                      >
                        {candidate.name} ({formatRupees(candidate.price)})
                        {!candidate.available ? ' · Sold Out' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {parseResult.unavailable_items.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-900">
              <p className="font-semibold">Currently Sold Out:</p>
              <ul className="mt-1 list-disc pl-4">
                {parseResult.unavailable_items.map((item) => (
                  <li key={item.menu_item_id}>
                    {item.quantity}× {item.name} ({formatRupees(item.unit_price)}
                    ) — cannot be added
                  </li>
                ))}
              </ul>
            </div>
          )}

          {parseResult.warnings.length > 0 && (
            <div
              role="status"
              className="space-y-1 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-950"
            >
              <p className="inline-flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Notes &amp; Unmatched Items</span>
              </p>
              <ul className="list-disc space-y-0.5 pl-4">
                {parseResult.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {previewItems.length > 0 && (
            <div className="flex items-center justify-between border-t border-stone-200/80 pt-3 text-sm">
              <span className="text-stone-600">
                Preview Subtotal ({previewTotals.itemCount}{' '}
                {previewTotals.itemCount === 1 ? 'item' : 'items'} ·{' '}
                {previewTotals.totalPrepUnits} prep units)
              </span>
              <span className="text-base font-semibold text-stone-900">
                {formatRupees(previewTotals.subtotalPaise)}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="primary"
              size="md"
              className="flex-1"
              disabled={previewItems.length === 0}
              onClick={handleConfirmAdd}
              icon={<ShoppingBag className="h-4 w-4" aria-hidden="true" />}
            >
              Confirm &amp; Add to Cart
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleEditRequest}
            >
              Edit Request
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={handleCancelPreview}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

