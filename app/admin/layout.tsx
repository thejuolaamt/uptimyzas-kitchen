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
    { name: 'Overview', icon: LayoutDashboard, path: '/admin' },
    { name: 'Staff', icon: Users, path: '/admin/staff' },
    { name: 'Menu', icon: Utensils, path: '/admin/menu' },
    { name: 'Shifts', icon: Clock, path: '/admin/shifts' },
    { name: 'Inventory', icon: Package, path: '/admin/inventory' },
    { name: 'Reports', icon: FileText, path: '/admin/reports' },
    { name: 'Chat', icon: MessageCircle, path: '/admin/chat' },
    { name: 'Settings', icon: Settings, path: '/admin/settings' },
  ]

  return (
    <div className="min-h-screen bg-bg-subtle">
      {/* Top Bar */}
      <div className="top-bar">
        <h1 className="font-display font-bold text-xl text-primary">UPTIMYZAS</h1>
        <div className="flex items-center gap-4">
          <span className="text-text-secondary text-sm">Admin Panel</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-danger hover:bg-danger/10 px-3 py-1 rounded-default transition"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
      
      <div className="flex pt-14">
        {/* Sidebar for desktop */}
        <div className="hidden md:block w-64 bg-white border-r border-border min-h-screen">
          <div className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.path
              return (
                <button
                  key={item.path}
                  onClick={() => router.push(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-default transition-colors ${
                    isActive 
                      ? 'bg-primary-light text-primary' 
                      : 'text-text-secondary hover:bg-bg-subtle hover:text-text-primary'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.name}</span>
                </button>
              )
            })}
            {/* Logout button in sidebar for desktop */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-default text-danger hover:bg-danger/10 transition-colors mt-4"
            >
              <LogOut size={20} />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-1">
          {children}
        </div>
      </div>

      {/* Bottom Navigation for Mobile */}
      <div className="md:hidden bottom-nav">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-default transition-colors ${
                isActive ? 'text-primary' : 'text-text-secondary'
              }`}
            >
              <Icon size={22} />
              <span className="text-xs font-medium">{item.name}</span>
            </button>
          )
        })}
        {/* Logout button in mobile bottom nav */}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 px-3 py-1 rounded-default text-danger"
        >
          <LogOut size={22} />
          <span className="text-xs font-medium">Exit</span>
        </button>
      </div>
    </div>
  )
}