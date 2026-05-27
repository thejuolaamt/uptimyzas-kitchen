'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ShoppingBag, Package, Wallet, History, MessageCircle, User, Users } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const navItems = [
    { name: 'Orders', icon: ShoppingBag, path: '/dashboard/orders' },
    { name: 'Stock', icon: Package, path: '/dashboard/stock' },
    { name: 'Expenses', icon: Wallet, path: '/dashboard/expenses' },
    { name: 'Activity', icon: Users, path: '/dashboard/shift-activities' },
    { name: 'History', icon: History, path: '/dashboard/history' },
    { name: 'Chat', icon: MessageCircle, path: '/dashboard/chat' },
    { name: 'Profile', icon: User, path: '/dashboard/profile' },
  ]

  return (
    <div className="min-h-screen bg-bg-subtle pb-16">
      <div className="top-bar">
        <h1 className="font-display font-bold text-xl text-primary">UPTIMYZAS</h1>
        <span className="text-text-secondary text-sm">Kitchen</span>
      </div>
      
      <div className="pt-14">
        {children}
      </div>

      <div className="bottom-nav">
        {navItems.map((item) => {
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
      </div>
    </div>
  )
}