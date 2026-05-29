'use client'

import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, Utensils, Clock, Package, FileText, MessageCircle, Settings, LogOut } from 'lucide-react'
import { clearSession } from '@/lib/auth'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = () => {
    clearSession()
    router.push('/auth/login')
  }

  const navItems = [
    { name: 'Overview',  icon: LayoutDashboard, path: '/admin' },
    { name: 'Staff',     icon: Users,            path: '/admin/staff' },
    { name: 'Menu',      icon: Utensils,         path: '/admin/menu' },
    { name: 'Shifts',    icon: Clock,            path: '/admin/shifts' },
    { name: 'Inventory', icon: Package,          path: '/admin/inventory' },
    { name: 'Reports',   icon: FileText,         path: '/admin/reports' },
    { name: 'Chat',      icon: MessageCircle,    path: '/admin/chat' },
    { name: 'Settings',  icon: Settings,         path: '/admin/settings' },
  ]

  return (
    <div className="min-h-screen bg-bg-subtle">

      {/* Top Bar */}
      <div className="top-bar">
        <h1 className="t-brand text-primary">Uptimyzas Kitchen</h1>
        <div className="flex items-center gap-4">
          <span className="t-small text-text-muted uppercase tracking-widest">Admin</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-danger px-3 py-1 rounded-[8px] hover:bg-danger/10 transition-colors min-h-0 min-w-0"
          >
            <LogOut size={16} />
            <span className="t-label hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      <div className="flex pt-14">

        {/* Sidebar — desktop */}
        <div className="hidden md:flex flex-col w-56 bg-white border-r border-border min-h-screen pt-4">
          <div className="flex-1 px-3 space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.path
              return (
                <button
                  key={item.path}
                  onClick={() => router.push(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] transition-colors min-h-0 ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-text-secondary hover:bg-bg-subtle hover:text-text-primary'
                  }`}
                >
                  <Icon size={18} />
                  <span className="t-body font-medium">{item.name}</span>
                </button>
              )
            })}
          </div>
          <div className="px-3 pb-6">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-danger hover:bg-danger/10 transition-colors min-h-0"
            >
              <LogOut size={18} />
              <span className="t-body font-medium">Logout</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>

      {/* Bottom Nav — mobile */}
      <div className="md:hidden bottom-nav">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex flex-col items-center gap-1 px-2 py-1 min-h-0 min-w-0 transition-colors ${
                isActive ? 'text-primary' : 'text-text-secondary'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </button>
          )
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 px-2 py-1 min-h-0 min-w-0 text-danger"
        >
          <LogOut size={20} />
          <span className="text-[10px] font-medium">Exit</span>
        </button>
      </div>

    </div>
  )
}