import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await getServerSession()

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="flex h-screen bg-[#f4f7f6] font-sans text-slate-900 overflow-hidden">
      {/* Barra lateral escura */}
      <aside className="w-72 bg-[#002b2d] text-white flex flex-col shadow-2xl z-10">
        <div className="p-8 border-b border-teal-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center font-bold text-2xl">
              M
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Morelli <span className="text-teal-300">Engenharia</span>
              </h2>
              <p className="text-[11px] text-teal-200/70 uppercase tracking-[0.2em]">
                Segurança do Trabalho
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-2 text-sm">
          <a className="flex items-center gap-3 px-3 py-2 rounded-2xl bg-teal-600/20 text-teal-200 font-semibold border-l-4 border-teal-400 cursor-pointer">
            <span className="w-6 h-6 rounded-full border border-teal-300/60 flex items-center justify-center text-xs">
              ◦
            </span>
            Painel Principal
          </a>
          <a className="flex items-center gap-3 px-3 py-2 rounded-2xl text-slate-200/80 hover:text-white hover:bg-white/5 transition cursor-pointer">
            <span className="w-6 h-6 rounded-full border border-slate-500/70 flex items-center justify-center text-xs">
              ◦
            </span>
            Laudos (PGR/PCMSO)
          </a>
          <a className="flex items-center gap-3 px-3 py-2 rounded-2xl text-slate-200/80 hover:text-white hover:bg-white/5 transition cursor-pointer">
            <span className="w-6 h-6 rounded-full border border-slate-500/70 flex items-center justify-center text-xs">
              ◦
            </span>
            Análise de Riscos
          </a>
          <a className="flex items-center gap-3 px-3 py-2 rounded-2xl text-slate-200/80 hover:text-white hover:bg-white/5 transition cursor-pointer">
            <span className="w-6 h-6 rounded-full border border-slate-500/70 flex items-center justify-center text-xs">
              ◦
            </span>
            Treinamentos
          </a>
        </nav>

        <div className="p-6 border-t border-slate-800/60 bg-black/20 text-xs text-teal-200/80 font-mono">
          USUÁRIO:
          <span className="block truncate text-teal-300 mt-1">{session.user?.email}</span>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 p-8 md:p-12 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-extrabold text-[#002b2d]">Visão Geral</h1>
            <p className="text-slate-500 mt-1 text-base">
              Acompanhe os principais indicadores de Segurança do Trabalho da sua operação.
            </p>
          </div>
          <a
            href="/api/auth/signout"
            className="px-5 py-2.5 rounded-full bg-white border border-slate-200 text-sm font-semibold text-red-600 hover:bg-red-50 hover:border-red-200 transition"
          >
            Sair
          </a>
        </header>

        {/* Cards de métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 mb-2">
              Laudos Ativos
            </h3>
            <p className="text-4xl font-black text-slate-800">12</p>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 mb-2">
              Funcionários Atendidos
            </h3>
            <p className="text-4xl font-black text-slate-800">148</p>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 mb-2">
              Riscos Pendentes
            </h3>
            <p className="text-4xl font-black text-amber-600">3</p>
          </div>
        </div>

        {/* CTA IA */}
        <div className="bg-gradient-to-br from-[#004d4d] to-[#002b2d] rounded-3xl p-10 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-xl">
            <h2 className="text-3xl font-bold mb-4">Gerar Novo Laudo com IA</h2>
            <p className="text-teal-100/80 mb-6 text-base">
              Use a inteligência artificial da Morelli para estruturar automaticamente a base dos seus documentos
              técnicos em poucos segundos.
            </p>
            <button className="bg-teal-400 text-[#002b2d] px-8 py-3 rounded-xl font-semibold text-sm tracking-wide shadow-lg shadow-teal-500/30 transform transition hover:bg-teal-300 hover:scale-[1.02]">
              + INICIAR NOVA ANÁLISE
            </button>
          </div>
          <div className="absolute right-[-5%] top-[-20%] text-[260px] font-black opacity-5 select-none">
            M
          </div>
        </div>
      </main>
    </div>
  )
}