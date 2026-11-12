import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock,
  LayoutDashboard,
  RefreshCw,
  ShieldCheck,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import {
  ApiClientError,
  createManagerMenuItem,
  createManagerStaff,
  deleteManagerMenuItem,
  fetchManagerDashboard,
  fetchManagerMenu,
  fetchManagerOrders,
  fetchManagerSales,
  fetchManagerSlots,
  fetchManagerStaff,
  toggleManagerMenuAvailability,
  updateKitchenOrderStatus,
  updateManagerCapacity,
  updateManagerMenuItem,
  updateManagerSlotStatus,
  updateManagerStaffStatus,
} from '../api/client'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ManagerMenuSection } from '../components/manager/ManagerMenuSection'
import { ManagerOrdersSection } from '../components/manager/ManagerOrdersSection'
import { ManagerOverviewSection } from '../components/manager/ManagerOverviewSection'
import { ManagerSalesSection } from '../components/manager/ManagerSalesSection'
import { ManagerSlotsSection } from '../components/manager/ManagerSlotsSection'
import { ManagerStaffSection } from '../components/manager/ManagerStaffSection'
import { MenuItemFormModal } from '../components/manager/MenuItemFormModal'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type {
  AuthenticatedUser,
  ManagerDashboard,
  ManagerSalesSummary,
  ManagerSlotSettings,
  MenuItem,
  MenuItemUpsertRequest,
  OrderDetail,
  OrderStatus,
  SlotWorkload,
  StaffCreateRequest,
} from '../types'
import { formatTimeWindow } from '../utils/format'
import type { ManagerSectionTab } from '../utils/manager'

const MANAGER_POLL_INTERVAL_MS = 8000

interface ManagerPageProps {
  currentUser?: AuthenticatedUser | null
}

export function ManagerPage({ currentUser }: ManagerPageProps) {
  const [activeTab, setActiveTab] = useState<ManagerSectionTab>('overview')

  const [dashboard, setDashboard] = useState<ManagerDashboard | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [orders, setOrders] = useState<OrderDetail[]>([])
  const [sales, setSales] = useState<ManagerSalesSummary | null>(null)
  const [slotSettings, setSlotSettings] = useState<ManagerSlotSettings | null>(
    null,
  )
  const [staffAccounts, setStaffAccounts] = useState<AuthenticatedUser[]>([])
  const [isCreatingStaff, setIsCreatingStaff] = useState(false)
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null)
  const [pendingStatusToggle, setPendingStatusToggle] =
    useState<AuthenticatedUser | null>(null)

  const [orderStatusFilter, setOrderStatusFilter] = useState('all')
  const [orderDateFilter, setOrderDateFilter] = useState('')
  const [orderSearchQuery, setOrderSearchQuery] = useState('')

  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [isSavingMenuItem, setIsSavingMenuItem] = useState(false)
  const [menuModalError, setMenuModalError] = useState<string | null>(null)
  const [togglingItemIds, setTogglingItemIds] = useState<Record<string, boolean>>({})
  const [pendingDeleteItem, setPendingDeleteItem] = useState<MenuItem | null>(null)
  const [isDeletingItem, setIsDeletingItem] = useState(false)

  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [isSavingCapacity, setIsSavingCapacity] = useState(false)
  const [pendingCloseSlot, setPendingCloseSlot] = useState<SlotWorkload | null>(
    null,
  )
  const [togglingSlotStart, setTogglingSlotStart] = useState<string | null>(
    null,
  )

  const inFlightRef = useRef(false)
  const mountedRef = useRef(true)

  const syncAllManagerData = useCallback(
    async (
      statusFilter: string,
      dateFilter: string,
      searchQuery: string,
    ) => {
      if (inFlightRef.current) return
      inFlightRef.current = true

      try {
        const [dashRes, menuRes, ordersRes, salesRes, slotsRes, staffRes] =
          await Promise.all([
            fetchManagerDashboard(),
            fetchManagerMenu(),
            fetchManagerOrders({
              status: statusFilter,
              date: dateFilter,
              search: searchQuery,
            }),
            fetchManagerSales(),
            fetchManagerSlots(),
            fetchManagerStaff(),
          ])

        if (!mountedRef.current) return
        setDashboard(dashRes)
        setMenuItems(menuRes)
        setOrders(ordersRes)
        setSales(salesRes)
        setSlotSettings(slotsRes)
        setStaffAccounts(staffRes)
        setLoadError(null)
      } catch (err) {
        if (!mountedRef.current) return
        const message =
          err instanceof ApiClientError
            ? err.message
            : 'Unable to reach the manager backend. Verify FastAPI is running.'
        setLoadError(message)
      } finally {
        inFlightRef.current = false
        if (mountedRef.current) {
          setIsInitialLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [],
  )

  useEffect(() => {
    mountedRef.current = true
    let active = true

    if (!inFlightRef.current) {
      inFlightRef.current = true
      Promise.all([
        fetchManagerDashboard(),
        fetchManagerMenu(),
        fetchManagerOrders({
          status: orderStatusFilter,
          date: orderDateFilter,
          search: orderSearchQuery,
        }),
        fetchManagerSales(),
        fetchManagerSlots(),
        fetchManagerStaff(),
      ])
        .then(([dashRes, menuRes, ordersRes, salesRes, slotsRes, staffRes]) => {
          if (!active || !mountedRef.current) return
          setDashboard(dashRes)
          setMenuItems(menuRes)
          setOrders(ordersRes)
          setSales(salesRes)
          setSlotSettings(slotsRes)
          setStaffAccounts(staffRes)
          setLoadError(null)
        })
        .catch((err: unknown) => {
          if (!active || !mountedRef.current) return
          const message =
            err instanceof ApiClientError
              ? err.message
              : 'Unable to reach the manager backend. Verify FastAPI is running.'
          setLoadError(message)
        })
        .finally(() => {
          inFlightRef.current = false
          if (!active || !mountedRef.current) return
          setIsInitialLoading(false)
          setIsRefreshing(false)
        })
    }

    const timerId = window.setInterval(() => {
      void syncAllManagerData(
        orderStatusFilter,
        orderDateFilter,
        orderSearchQuery,
      )
    }, MANAGER_POLL_INTERVAL_MS)

    return () => {
      active = false
      mountedRef.current = false
      window.clearInterval(timerId)
    }
  }, [
    orderStatusFilter,
    orderDateFilter,
    orderSearchQuery,
    syncAllManagerData,
  ])

  const handleManualRefresh = useCallback(() => {
    if (inFlightRef.current) return
    setLoadError(null)
    setIsRefreshing(true)
    void syncAllManagerData(
      orderStatusFilter,
      orderDateFilter,
      orderSearchQuery,
    )
  }, [orderStatusFilter, orderDateFilter, orderSearchQuery, syncAllManagerData])

  const handleSaveMenuItem = useCallback(
    async (payload: MenuItemUpsertRequest) => {
      if (isSavingMenuItem) return
      setIsSavingMenuItem(true)
      setMenuModalError(null)
      setActionError(null)
      setSuccessNotice(null)

      try {
        if (editingItem) {
          const updated = await updateManagerMenuItem(editingItem.id, payload)
          setSuccessNotice(`Updated "${updated.name}" on the canteen menu.`)
        } else {
          const created = await createManagerMenuItem(payload)
          setSuccessNotice(`Added "${created.name}" to the canteen menu.`)
        }
        setIsMenuModalOpen(false)
        setEditingItem(null)
        await syncAllManagerData(
          orderStatusFilter,
          orderDateFilter,
          orderSearchQuery,
        )
      } catch (err) {
        const message =
          err instanceof ApiClientError
            ? err.message
            : 'Unable to save menu item.'
        setMenuModalError(message)
      } finally {
        setIsSavingMenuItem(false)
      }
    },
    [
      editingItem,
      isSavingMenuItem,
      orderDateFilter,
      orderSearchQuery,
      orderStatusFilter,
      syncAllManagerData,
    ],
  )

  const handleToggleAvailability = useCallback(
    async (item: MenuItem) => {
      if (togglingItemIds[item.id]) return
      setActionError(null)
      setSuccessNotice(null)
      setTogglingItemIds((prev) => ({ ...prev, [item.id]: true }))

      try {
        const updated = await toggleManagerMenuAvailability(
          item.id,
          !item.available,
        )
        setMenuItems((prev) =>
          prev.map((entry) => (entry.id === updated.id ? updated : entry)),
        )
        setSuccessNotice(
          `"${updated.name}" marked ${updated.available ? 'Available' : 'Sold Out'}.`,
        )
        void syncAllManagerData(
          orderStatusFilter,
          orderDateFilter,
          orderSearchQuery,
        )
      } catch (err) {
        setActionError(
          err instanceof ApiClientError
            ? err.message
            : 'Unable to update item availability.',
        )
      } finally {
        setTogglingItemIds((prev) => {
          const next = { ...prev }
          delete next[item.id]
          return next
        })
      }
    },
    [
      orderDateFilter,
      orderSearchQuery,
      orderStatusFilter,
      syncAllManagerData,
      togglingItemIds,
    ],
  )

  const handleConfirmDeleteItem = useCallback(async () => {
    if (!pendingDeleteItem || isDeletingItem) return
    setIsDeletingItem(true)
    setActionError(null)
    setSuccessNotice(null)

    try {
      const res = await deleteManagerMenuItem(pendingDeleteItem.id)
      setPendingDeleteItem(null)
      setSuccessNotice(res.message)
      await syncAllManagerData(
        orderStatusFilter,
        orderDateFilter,
        orderSearchQuery,
      )
    } catch (err) {
      setActionError(
        err instanceof ApiClientError
          ? err.message
          : 'Unable to delete menu item.',
      )
      setPendingDeleteItem(null)
    } finally {
      setIsDeletingItem(false)
    }
  }, [
    isDeletingItem,
    orderDateFilter,
    orderSearchQuery,
    orderStatusFilter,
    pendingDeleteItem,
    syncAllManagerData,
  ])

  const handleAdvanceOrderStatus = useCallback(
    async (order: OrderDetail, nextStatus: OrderStatus) => {
      if (updatingOrderId) return
      setUpdatingOrderId(order.id)
      setActionError(null)
      setSuccessNotice(null)

      try {
        const updated = await updateKitchenOrderStatus(order.id, nextStatus)
        setOrders((prev) =>
          prev.map((entry) => (entry.id === updated.id ? updated : entry)),
        )
        setSuccessNotice(
          `Order ${updated.pickup_code} updated to ${updated.status}.`,
        )
        await syncAllManagerData(
          orderStatusFilter,
          orderDateFilter,
          orderSearchQuery,
        )
      } catch (err) {
        setActionError(
          err instanceof ApiClientError
            ? err.message
            : 'Unable to update order status.',
        )
      } finally {
        setUpdatingOrderId(null)
      }
    },
    [
      orderDateFilter,
      orderSearchQuery,
      orderStatusFilter,
      syncAllManagerData,
      updatingOrderId,
    ],
  )

  const handleUpdateCapacity = useCallback(
    async (capacityUnits: number) => {
      if (isSavingCapacity) return
      setIsSavingCapacity(true)
      setActionError(null)
      setSuccessNotice(null)

      try {
        const updated = await updateManagerCapacity(capacityUnits)
        setSlotSettings(updated)
        setSuccessNotice(
          `Default slot capacity updated to ${updated.slot_capacity_units} prep units.`,
        )
        await syncAllManagerData(
          orderStatusFilter,
          orderDateFilter,
          orderSearchQuery,
        )
      } catch (err) {
        setActionError(
          err instanceof ApiClientError
            ? err.message
            : 'Unable to update slot capacity.',
        )
      } finally {
        setIsSavingCapacity(false)
      }
    },
    [
      isSavingCapacity,
      orderDateFilter,
      orderSearchQuery,
      orderStatusFilter,
      syncAllManagerData,
    ],
  )

  const handleSlotClosureChange = useCallback(
    async (slot: SlotWorkload, isClosed: boolean) => {
      if (togglingSlotStart) return
      setTogglingSlotStart(slot.slot_start)
      setActionError(null)
      setSuccessNotice(null)

      try {
        await updateManagerSlotStatus({
          slot_start: slot.slot_start,
          is_closed: isClosed,
          reason: isClosed ? 'Closed by canteen manager' : null,
        })
        setPendingCloseSlot(null)
        setSuccessNotice(
          `Slot ${formatTimeWindow(slot.slot_start, slot.slot_end)} ${isClosed ? 'closed to new orders' : 'reopened'}.`,
        )
        await syncAllManagerData(
          orderStatusFilter,
          orderDateFilter,
          orderSearchQuery,
        )
      } catch (err) {
        setActionError(
          err instanceof ApiClientError
            ? err.message
            : 'Unable to update pickup slot status.',
        )
        setPendingCloseSlot(null)
      } finally {
        setTogglingSlotStart(null)
      }
    },
    [
      orderDateFilter,
      orderSearchQuery,
      orderStatusFilter,
      syncAllManagerData,
      togglingSlotStart,
    ],
  )

  const handleCreateStaff = useCallback(
    async (payload: StaffCreateRequest): Promise<boolean> => {
      if (isCreatingStaff) return false
      setIsCreatingStaff(true)
      setActionError(null)
      setSuccessNotice(null)
      try {
        const created = await createManagerStaff(payload)
        setStaffAccounts((prev) => [created, ...prev])
        setSuccessNotice(
          `Provisioned ${created.role === 'MANAGER' ? 'Manager' : 'Canteen Staff'} account for ${created.email}.`,
        )
        return true
      } catch (err) {
        setActionError(
          err instanceof ApiClientError
            ? err.message
            : 'Unable to create staff account.',
        )
        return false
      } finally {
        setIsCreatingStaff(false)
      }
    },
    [isCreatingStaff],
  )

  const handleConfirmToggleStaffStatus = useCallback(async () => {
    if (!pendingStatusToggle || togglingUserId) return
    const target = pendingStatusToggle
    const nextActive = !target.is_active
    setTogglingUserId(target.id)
    setActionError(null)
    setSuccessNotice(null)
    try {
      const updated = await updateManagerStaffStatus(target.id, nextActive)
      setStaffAccounts((prev) =>
        prev.map((acct) => (acct.id === updated.id ? updated : acct)),
      )
      setPendingStatusToggle(null)
      setSuccessNotice(
        `${updated.full_name} has been ${updated.is_active ? 'reactivated' : 'deactivated and signed out of active sessions'}.`,
      )
    } catch (err) {
      setActionError(
        err instanceof ApiClientError
          ? err.message
          : 'Unable to update staff account status.',
      )
      setPendingStatusToggle(null)
    } finally {
      setTogglingUserId(null)
    }
  }, [pendingStatusToggle, togglingUserId])

  const tabs: {
    id: ManagerSectionTab
    label: string
    icon: typeof LayoutDashboard
  }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    {
      id: 'menu',
      label: `Menu (${menuItems.length})`,
      icon: UtensilsCrossed,
    },
    { id: 'orders', label: 'Orders', icon: ClipboardList },
    { id: 'sales', label: 'Sales', icon: BarChart3 },
    { id: 'slots', label: 'Slot Settings', icon: Clock },
    { id: 'staff', label: `Staff (${staffAccounts.length})`, icon: Users },
  ]

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
            <span>
              {currentUser
                ? `Authenticated Manager · ${currentUser.full_name}`
                : 'Authenticated Manager Console'}
            </span>
          </div>
          <h1 className="mt-2.5 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            Manager Operations &amp; Menu Console
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Manage menu availability, track finalized sales, inspect all
            orders, and control pickup-slot capacity.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          loading={isRefreshing}
          onClick={handleManualRefresh}
          icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
        >
          Refresh Data
        </Button>
      </div>

      <nav
        aria-label="Manager dashboard sections"
        className="flex flex-wrap gap-2 border-b border-stone-200/80 pb-3"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          const selected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors cursor-pointer ${
                selected
                  ? 'border-emerald-700 bg-emerald-700 text-white shadow-xs'
                  : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>

      {successNotice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            <span>{successNotice}</span>
          </span>
          <button
            type="button"
            onClick={() => setSuccessNotice(null)}
            className="text-xs font-semibold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{actionError}</span>
          </span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs font-semibold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {loadError && !dashboard ? (
        <Card className="border-rose-200 bg-rose-50/50 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-rose-700" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold text-stone-900">
                  Unable to load Manager Console
                </h2>
                <p className="mt-1 text-sm text-stone-600">{loadError}</p>
              </div>
            </div>
            <Button variant="primary" size="sm" onClick={handleManualRefresh}>
              Retry
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {activeTab === 'overview' && (
            <ManagerOverviewSection
              dashboard={dashboard}
              isLoading={isInitialLoading}
            />
          )}

          {activeTab === 'menu' && (
            <ManagerMenuSection
              items={menuItems}
              isLoading={isInitialLoading}
              togglingItemIds={togglingItemIds}
              onOpenAddModal={() => {
                setEditingItem(null)
                setMenuModalError(null)
                setIsMenuModalOpen(true)
              }}
              onOpenEditModal={(item) => {
                setEditingItem(item)
                setMenuModalError(null)
                setIsMenuModalOpen(true)
              }}
              onToggleAvailability={(item) => {
                void handleToggleAvailability(item)
              }}
              onRequestDelete={setPendingDeleteItem}
            />
          )}

          {activeTab === 'orders' && (
            <ManagerOrdersSection
              orders={orders}
              isLoading={isInitialLoading}
              statusFilter={orderStatusFilter}
              dateFilter={orderDateFilter}
              searchQuery={orderSearchQuery}
              updatingOrderId={updatingOrderId}
              onStatusFilterChange={setOrderStatusFilter}
              onDateFilterChange={setOrderDateFilter}
              onSearchQueryChange={setOrderSearchQuery}
              onResetFilters={() => {
                setOrderStatusFilter('all')
                setOrderDateFilter('')
                setOrderSearchQuery('')
              }}
              onAdvanceOrderStatus={handleAdvanceOrderStatus}
            />
          )}

          {activeTab === 'sales' && (
            <ManagerSalesSection sales={sales} isLoading={isInitialLoading} />
          )}

          {activeTab === 'slots' && (
            <ManagerSlotsSection
              slotSettings={slotSettings}
              isLoading={isInitialLoading}
              isSavingCapacity={isSavingCapacity}
              togglingSlotStart={togglingSlotStart}
              onUpdateCapacity={handleUpdateCapacity}
              onRequestCloseSlot={setPendingCloseSlot}
              onReopenSlot={(slot) => {
                void handleSlotClosureChange(slot, false)
              }}
            />
          )}

          {activeTab === 'staff' && (
            <ManagerStaffSection
              staffAccounts={staffAccounts}
              currentManagerId={currentUser?.id ?? ''}
              isLoading={isInitialLoading}
              isSubmitting={isCreatingStaff}
              togglingUserId={togglingUserId}
              onCreateStaff={handleCreateStaff}
              onRequestToggleStatus={setPendingStatusToggle}
            />
          )}
        </>
      )}

      {isMenuModalOpen && (
        <MenuItemFormModal
          key={editingItem?.id ?? 'new-menu-item'}
          open={isMenuModalOpen}
          editingItem={editingItem}
          isSaving={isSavingMenuItem}
          serverError={menuModalError}
          onClose={() => {
            if (!isSavingMenuItem) {
              setIsMenuModalOpen(false)
              setEditingItem(null)
            }
          }}
          onSubmit={(payload) => {
            void handleSaveMenuItem(payload)
          }}
        />
      )}

      <ConfirmDialog
        open={pendingDeleteItem !== null}
        title="Remove menu item?"
        description={
          pendingDeleteItem
            ? `Archive "${pendingDeleteItem.name}" from active student and manager menus? Past orders will retain their original item name and price snapshots.`
            : ''
        }
        confirmLabel="Remove Item"
        confirmVariant="danger"
        isConfirming={isDeletingItem}
        onCancel={() => {
          if (!isDeletingItem) setPendingDeleteItem(null)
        }}
        onConfirm={() => {
          void handleConfirmDeleteItem()
        }}
      />

      <ConfirmDialog
        open={pendingCloseSlot !== null}
        title="Close pickup slot?"
        description={
          pendingCloseSlot
            ? `Close ${formatTimeWindow(pendingCloseSlot.slot_start, pendingCloseSlot.slot_end)} to new orders? Existing orders already assigned to this slot will remain unaffected.`
            : ''
        }
        confirmLabel="Close Slot"
        confirmVariant="danger"
        isConfirming={
          pendingCloseSlot
            ? togglingSlotStart === pendingCloseSlot.slot_start
            : false
        }
        onCancel={() => {
          if (!togglingSlotStart) setPendingCloseSlot(null)
        }}
        onConfirm={() => {
          if (pendingCloseSlot) {
            void handleSlotClosureChange(pendingCloseSlot, true)
          }
        }}
      />

      <ConfirmDialog
        open={pendingStatusToggle !== null}
        title={
          pendingStatusToggle?.is_active
            ? 'Deactivate account?'
            : 'Reactivate account?'
        }
        description={
          pendingStatusToggle
            ? pendingStatusToggle.is_active
              ? `Deactivate ${pendingStatusToggle.full_name} (${pendingStatusToggle.email})? All active sessions for this user will be immediately revoked.`
              : `Restore login access for ${pendingStatusToggle.full_name} (${pendingStatusToggle.email})?`
            : ''
        }
        confirmLabel={
          pendingStatusToggle?.is_active ? 'Deactivate Account' : 'Reactivate Account'
        }
        confirmVariant={pendingStatusToggle?.is_active ? 'danger' : 'primary'}
        isConfirming={
          pendingStatusToggle
            ? togglingUserId === pendingStatusToggle.id
            : false
        }
        onCancel={() => {
          if (!togglingUserId) setPendingStatusToggle(null)
        }}
        onConfirm={() => {
          void handleConfirmToggleStaffStatus()
        }}
      />
    </section>
  )
}
