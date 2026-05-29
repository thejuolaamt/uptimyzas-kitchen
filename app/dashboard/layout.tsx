'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ShoppingBag, Package, Wallet, Users, MessageCircle, User, Home } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const navItems = [
    { name: 'Home', icon: Home, path: '/dashboard' },
    { name: 'Orders', icon: ShoppingBag, path: '/dashboard/orders' },
    { name: 'Stock', icon: Package, path: '/dashboard/stock' },
    { name: 'Expenses', icon: Wallet, path: '/dashboard/expenses' },
    { name: 'Activity', icon: Users, path: '/dashboard/shift-activities' },
    { name: 'Chat', icon: MessageCircle, path: '/dashboard/chat' },
    { name: 'Profile', icon: User, path: '/dashboard/profile' },
  ]

  return (
    <div className="min-h-screen bg-bg-subtle pb-16">
      <div className="top-bar">
        <h1 className="t-brand text-primary">Uptimyzas Kitchen</h1>
        <span className="t-small text-text-muted uppercase tracking-widest">Staff</span>
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
              className={`flex flex-col items-center gap-1 px-2 py-1 min-h-0 min-w-0 transition-colors ${
                isActive ? 'text-primary' : 'text-text-secondary'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}