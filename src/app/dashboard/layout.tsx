export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <section className="min-h-screen bg-gray-50">
      {/* Aqui você poderia colocar um menu lateral no futuro */}
      <main>{children}</main>
    </section>
  )
}