import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/ui/sidebar'
import { QuickSignalButton } from '@/components/ui/quick-signal'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '云艺化AI原生LTC人机协作系统',
  description: 'AI 原生多数字员工协同 LTC Runtime',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50 text-gray-900`}>
        <div className="flex h-full">
          <Sidebar />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
        <QuickSignalButton />
      </body>
    </html>
  )
}
