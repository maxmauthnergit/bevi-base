import { Sidebar } from '@/components/nav/Sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full" style={{ backgroundColor: '#F5F4F0' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
