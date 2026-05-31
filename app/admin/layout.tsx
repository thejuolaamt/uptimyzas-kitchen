'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, X, Utensils, Clock,
  Package, FileText, MessageCircle, Settings, LogOut, Menu
} from 'lucide-react'
import { clearSession } from '@/lib/auth'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const bottomNav = [
    { name: 'Overview', icon: LayoutDashboard, path: '/admin' },
    { name: 'Staff',    icon: Users,           path: '/admin/staff' },
  ]

  const drawerItems = [
    { name: 'Menu Items', icon: Utensils,      path: '/admin/menu' },
    { name: 'Shifts',     icon: Clock,         path: '/admin/shifts' },
    { name: 'Inventory',  icon: Package,       path: '/admin/inventory' },
    { name: 'Reports',    icon: FileText,      path: '/admin/reports' },
    { name: 'Chat',       icon: MessageCircle, path: '/admin/chat' },
    { name: 'Settings',   icon: Settings,      path: '/admin/settings' },
  ]

  const allPaths = [...bottomNav, ...drawerItems]

  const getPageTitle = () => {
    return allPaths.find(i => i.path === pathname)?.name || 'Admin'
  }

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
      {pathname === '/admin' ? (
        <div className="top-bar">
          <h1 className="t-brand text-primary">Uptimyzas Kitchen</h1>
          <p className="t-small text-text-muted uppercase tracking-widest">Admin</p>
        </div>
      ) : (
        <div className="top-bar">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-text-secondary min-h-0 min-w-0"
          >
            <span className="text-lg">←</span>
          </button>
          <p className="t-h3 text-text-primary">{getPageTitle()}</p>
          <div className="w-6" />
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:flex pt-14">
        <div className="w-56 bg-white border-r border-border min-h-screen flex flex-col fixed top-14 left-0 bottom-0">
          <div className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {[...bottomNav, ...drawerItems].map(({ name, icon: Icon, path }) => {
              const isActive = pathname === path
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] transition-colors min-h-0 ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-text-secondary hover:bg-bg-subtle hover:text-text-primary'
                  }`}
                >
                  <Icon size={18} />
                  <span className="t-body font-medium">{name}</span>
                </button>
              )
            })}
          </div>
          <div className="px-3 pb-6 border-t border-border pt-3">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-danger hover:bg-danger/10 transition-colors min-h-0"
            >
              <LogOut size={18} />
              <span className="t-body font-medium">Sign Out</span>
            </button>
          </div>
        </div>
        <div className="flex-1 ml-56">
          {children}
        </div>
      </div>

      {/* Mobile content */}
      <div className="md:hidden pt-14 pb-20">
        {children}
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden bottom-nav">
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
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Drawer */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[24px] transition-transform duration-300 ${
        menuOpen ? 'translate-y-0' : 'translate-y-full'
      }`}>
        <div className="w-10 h-1 rounded-full bg-border mx-auto mt-4 mb-2" />

        <div className="flex justify-between items-center px-5 py-3 border-b border-border">
          <p className="t-h3 text-text-primary">Admin Menu</p>
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