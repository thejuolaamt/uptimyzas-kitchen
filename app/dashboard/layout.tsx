'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ShoppingBag, Clock,
  Package, Receipt, Users,
  LogOut, Menu, MessageCircle, X
} from 'lucide-react'
import { clearSession } from '@/lib/auth'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  // Check if we're on chat page - hide navigation
  const isChatPage = pathname === '/dashboard/chat' || pathname === '/dashboard/chat/' || pathname?.includes('/chat')

  const bottomNav = [
    { name: 'Home', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Orders', icon: ShoppingBag, path: '/dashboard/orders' },
    { name: 'Chat', icon: MessageCircle, path: '/dashboard/chat' },
  ]

  const drawerItems = [
    { name: 'Stock Board', icon: Package, path: '/dashboard/stock' },
    { name: 'Expenses', icon: Receipt, path: '/dashboard/expenses' },
    { name: 'Activities', icon: Clock, path: '/dashboard/shift-activities' },
    { name: 'Profile', icon: Users, path: '/dashboard/profile' },
    { name: 'Order History', icon: Receipt, path: '/dashboard/order-history' },
  ]

  const allItems = [...bottomNav, ...drawerItems]

  const getPageTitle = () => {
    if (pathname === '/dashboard') return null
    if (isChatPage) return null
    const item = allItems.find(i => i.path === pathname)
    return item?.name || 'Staff'
  }

  const pageTitle = getPageTitle()

  const navigate = (path: string) => {
    setMenuOpen(false)
    router.push(path)
  }

  const handleLogout = () => {
    clearSession()
    router.push('/auth/login')
  }

  // For chat page - render without any navigation (full screen)
  if (isChatPage) {
    return (
      <div className="min-h-screen w-full">
        {children}
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-bg-subtle overflow-hidden">
      {/* Top bar */}
      <div className="top-bar fixed top-0 left-0 right-0 z-20 bg-white flex-shrink-0">
        {pageTitle ? (
          <>
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-9 h-9 min-h-0 min-w-0 rounded-full hover:bg-bg-subtle transition-colors text-text-secondary"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <p className="t-h3 text-text-primary">{pageTitle}</p>
            <div className="w-9" />
          </>
        ) : (
          <>
            <h1 className="t-brand text-primary">Uptimyzas Kitchen</h1>
            <span className="t-small text-text-muted uppercase tracking-widest">Staff</span>
          </>
        )}
      </div>

      {/* Desktop layout */}
      <div className="hidden md:flex flex-1 pt-14 overflow-hidden">
        <aside className="w-56 bg-white border-r border-border flex-shrink-0 overflow-y-auto">
          <div className="flex flex-col h-full">
            <div className="flex-1 px-3 py-4 space-y-0.5">
              {allItems.map(({ name, icon: Icon, path }) => {
                const isActive = pathname === path
                return (
                  <button
                    key={path}
                    onClick={() => navigate(path)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-colors min-h-0 ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-text-secondary hover:bg-bg-subtle hover:text-text-primary'
                    }`}
                  >
                    <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                    <span className="t-body font-medium">{name}</span>
                  </button>
                )
              })}
            </div>
            <div className="px-3 pb-6 border-t border-border pt-3">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-danger hover:bg-danger/5 transition-colors min-h-0"
              >
                <LogOut size={18} />
                <span className="t-body font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile content */}
      <div className="md:hidden flex-1 pt-14 pb-20 overflow-y-auto">
        {children}
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden bottom-nav fixed bottom-0 left-0 right-0 z-20 bg-white">
        {bottomNav.map(({ name, icon: Icon, path }) => {
          const isActive = pathname === path
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-1 min-h-0 min-w-0 px-8 pb-1 pt-2 relative transition-colors ${
                isActive ? 'text-primary' : 'text-text-muted'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-primary" />
              )}
              <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="text-[10px] font-medium">{name}</span>
            </button>
          )
        })}

        <button
          onClick={() => setMenuOpen(true)}
          className={`flex flex-col items-center gap-1 min-h-0 min-w-0 px-8 pb-1 pt-2 relative transition-colors ${
            drawerItems.some(i => i.path === pathname) ? 'text-primary' : 'text-text-muted'
          }`}
        >
          {drawerItems.some(i => i.path === pathname) && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-primary" />
          )}
          <Menu size={22} strokeWidth={1.8} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>

      {/* Drawer overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Drawer */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[24px] transition-transform duration-300 ease-out ${
        menuOpen ? 'translate-y-0' : 'translate-y-full'
      }`}>
        <div className="w-10 h-1 rounded-full bg-border mx-auto mt-3 mb-1" />

        <div className="flex justify-between items-center px-5 py-3 border-b border-border">
          <p className="t-h3 text-text-primary">Menu</p>
          <button
            onClick={() => setMenuOpen(false)}
            className="text-text-muted min-h-0 min-w-0 w-9 h-9 flex items-center justify-center rounded-full hover:bg-bg-subtle"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-4 grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
          {drawerItems.map(({ name, icon: Icon, path }) => {
            const isActive = pathname === path
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex flex-col items-center gap-2 py-4 rounded-[14px] transition-colors min-h-0 ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'bg-bg-subtle text-text-secondary hover:bg-border'
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="t-small font-medium">{name}</span>
              </button>
            )
          })}
        </div>

        <div className="px-5 pb-8 pt-1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-[12px] text-danger border border-danger/20 t-label hover:bg-danger/5 transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}