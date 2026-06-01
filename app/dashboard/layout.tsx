'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home, ShoppingBag, X,
  Package, Wallet, History,
  MessageCircle, User, Users,
  LogOut, Menu
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

  const bottomNav = [
    { name: 'Home',   icon: Home,        path: '/dashboard' },
    { name: 'Orders', icon: ShoppingBag, path: '/dashboard/orders' },
  ]

  const drawerItems = [
    { name: 'Stock',    icon: Package,       path: '/dashboard/stock' },
    { name: 'Expenses', icon: Wallet,        path: '/dashboard/expenses' },
    { name: 'History',  icon: History,       path: '/dashboard/history' },
    { name: 'Activity', icon: Users,         path: '/dashboard/shift-activities' },
    { name: 'Chat',     icon: MessageCircle, path: '/dashboard/chat' },
    { name: 'Profile',  icon: User,          path: '/dashboard/profile' },
  ]

  const allPaths = [...bottomNav, ...drawerItems]

  const getPageTitle = () => {
    if (pathname === '/dashboard') return null
    return allPaths.find(i => i.path === pathname)?.name || ''
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

  return (
    <div className="min-h-screen bg-bg-subtle">

      {/* Top bar */}
      <div className="top-bar">
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

      {/* Page content */}
      <div className="pt-14 pb-20">
        {children}
      </div>

      {/* Bottom nav */}
      <div className="bottom-nav">
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

        {/* Hamburger */}
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
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Drawer */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[24px] transition-transform duration-300 ease-out ${
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

        <div className="px-4 py-4 grid grid-cols-3 gap-2">
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