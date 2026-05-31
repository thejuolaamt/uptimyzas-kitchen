'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Home, ShoppingBag, X, Package, Wallet, History, MessageCircle, User, Users, LogOut, Menu } from 'lucide-react'
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

      {/* Top bar — only on home, hidden on inner pages */}
      {pathname === '/dashboard' && (
        <div className="top-bar">
          <h1 className="t-brand text-primary">Uptimyzas Kitchen</h1>
          <p className="t-small text-text-muted uppercase tracking-widest">Staff</p>
        </div>
      )}

      {/* Inner page top bar — back button + page title */}
      {pathname !== '/dashboard' && (
        <div className="top-bar">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-text-secondary min-h-0 min-w-0"
          >
            <span className="text-lg">←</span>
          </button>
          <p className="t-h3 text-text-primary">
            {drawerItems.find(i => i.path === pathname)?.name ||
             (pathname === '/dashboard/orders' ? 'Orders' : '')}
          </p>
          <div className="w-6" />
        </div>
      )}

      {/* Page content */}
      <div className="pt-14 pb-20">
        {children}
      </div>

      {/* Bottom nav — 3 items */}
      <div className="bottom-nav">
        {bottomNav.map(({ name, icon: Icon, path }) => {
          const isActive = pathname === path
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-1 min-h-0 min-w-0 px-6 transition-colors relative ${
                isActive ? 'text-primary' : 'text-text-secondary'
              }`}
            >
              {isActive && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary" />
              )}
              <Icon size={22} />
              <span className="text-[10px] font-medium">{name}</span>
            </button>
          )
        })}

        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen(true)}
          className={`flex flex-col items-center gap-1 min-h-0 min-w-0 px-6 transition-colors ${
            menuOpen ? 'text-primary' : 'text-text-secondary'
          }`}
        >
          <Menu size={22} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>

      {/* Drawer overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Drawer */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[24px] transition-transform duration-300 ${
        menuOpen ? 'translate-y-0' : 'translate-y-full'
      }`}>
        <div className="w-10 h-1 rounded-full bg-border mx-auto mt-4 mb-2" />

        <div className="flex justify-between items-center px-5 py-3 border-b border-border">
          <p className="t-h3 text-text-primary">Menu</p>
          <button
            onClick={() => setMenuOpen(false)}
            className="text-text-muted min-h-0 min-w-0 w-8 h-8 flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-3 grid grid-cols-3 gap-2">
          {drawerItems.map(({ name, icon: Icon, path }) => {
            const isActive = pathname === path
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex flex-col items-center gap-2 p-4 rounded-[12px] transition-colors ${
                  isActive ? 'bg-primary/10 text-primary' : 'bg-bg-subtle text-text-secondary'
                }`}
              >
                <Icon size={22} />
                <span className="t-small font-medium text-center">{name}</span>
              </button>
            )
          })}
        </div>

        <div className="px-4 pb-6 pt-2 border-t border-border mx-4 mt-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] text-danger border border-danger/20 t-label"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>

    </div>
  )
}