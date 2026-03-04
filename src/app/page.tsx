import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await getServerSession()
  if (!session) redirect("/login")

  return (
    <div className="flex h-screen bg-[#f4f7f6] font-sans text-slate-800">
      {/* Sidebar - Identidade Morelli */}
      <aside className="w-72 bg-[#002b2d] text-white flex flex-col shadow-2xl">
        <div className="p-8 border-b border-teal-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center font-bold text-2xl">M</div>
            <h2 className="text-xl font-bold tracking-tight">Morelli <span className="text-teal-400">SaaS</span></h2>
          </div>
        </div>
        <nav className="flex-1 p-6 space-y-4">
          <div className="bg-teal-600/20 text-teal-300 p-3 rounded-lg font-bold border-l-4 border-teal-500">Dashboard</div>
          <div className="text-slate-400 p-3 hover:text-white transition cursor-pointer">Engenharia de Seg.</div>
          <div className="text-slate-400 p-3 hover:text-white transition cursor-pointer">Higiene Ocupacional</div>
        </nav>
        <div className="p-6 bg-black/20 text-xs text-teal-500 font-mono">USUÁRIO: {session.user?.email}</div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 overflow-y-auto">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h1 className="text-4xl font-black text-[#002b2d]">Visão Geral</h1>
            <p className="text-slate-500">Gestão Inteligente de Segurança do Trabalho</p>
          </div>
          <button className="bg-white border border-slate-200 px-6 py-2 rounded-full font-bold text-red-500 hover:bg-red-50 transition">Sair</button>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          <div className="bg-white p-8 rounded-2xl shadow-sm border-b-4 border-teal-500">
            <span className="text-slate-400 text-xs font-bold uppercase">Laudos Emitidos</span>
            <div className="text-4xl font-black mt-2">24</div>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-sm border-b-4 border-teal-500">
            <span className="text-slate-400 text-xs font-bold uppercase">Vidas Protegidas</span>
            <div className="text-4xl font-black mt-2">1,250</div>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-sm border-b-4 border-orange-400">
            <span className="text-slate-400 text-xs font-bold uppercase">Pendências</span>
            <div className="text-4xl font-black mt-2 text-orange-600">03</div>
          </div>
        </div>

        {/* CTA IA */}
        <div className="bg-gradient-to-br from-[#004d4d] to-[#002b2d] rounded-3xl p-10 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-xl">
            <h2 className="text-3xl font-bold mb-4">Gerar Novo Laudo com IA</h2>
            <p className="text-teal-100/80 mb-6 text-lg">Nossa inteligência artificial analisa os riscos ambientais e gera a base do seu documento em segundos.</p>
            <button className="bg-teal-400 text-[#002b2d] px-8 py-4 rounded-xl font-black text-lg hover:bg-teal-300 transition shadow-lg shadow-teal-500/20">
              + INICIAR NOVA ANÁLISE
            </button>
          </div>
          <div className="absolute right-[-5%] top-[-20%] text-[300px] font-black opacity-5 select-none">M</div>
        </div>
      </main>
    </div>
  )
}