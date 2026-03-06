import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Morelli Engenharia | SaaS',
  description: 'Sistema de Segurança do Trabalho',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // Tiramos as restrições de cor daqui para o Tailwind funcionar
    <html lang="pt-BR">
      <body className={`${inter.className} bg-gray-50 text-slate-900 antialiased`}>
        {children}
      </body>
    </html>
  )
}