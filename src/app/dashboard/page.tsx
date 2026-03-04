'use client'

import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import styles from "./dashboard.module.css"
import DocumentsSection from "./DocumentsSection"

const NAV_ITEMS = [
  { id: "overview",  label: "Visão Geral",    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { id: "documents", label: "Documentos",     icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { id: "employees", label: "Funcionários",   icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { id: "ai",        label: "Análise com IA", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
  { id: "reports",   label: "Relatórios",     icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
]

type Employee = {
  id: string
  email: string
  name: string | null
  role: string
  createdAt: string
}

const ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: "Super Admin",
  ADMIN: "Administrador",
  USER: "Funcionário",
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeNav, setActiveNav] = useState("overview")
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Employees state
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [employeeError, setEmployeeError] = useState("")

  const fetchEmployees = useCallback(async () => {
    setLoadingEmployees(true)
    setEmployeeError("")
    try {
      const res = await fetch("/api/employees")
      if (!res.ok) throw new Error("Erro ao buscar funcionários.")
      const data = await res.json()
      setEmployees(data)
    } catch {
      setEmployeeError("Não foi possível carregar os funcionários.")
    } finally {
      setLoadingEmployees(false)
    }
  }, [])

  useEffect(() => {
    if (activeNav === "employees" || activeNav === "overview") {
      fetchEmployees()
    }
  }, [activeNav, fetchEmployees])

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este usuário?")) return
    setDeletingId(id)
    try {
      const res = await fetch("/api/employees", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      setEmployees(prev => prev.filter(e => e.id !== id))
    } catch {
      alert("Erro ao remover usuário.")
    } finally {
      setDeletingId(null)
    }
  }

  if (status === "loading") return (
    <div className={styles.loadingScreen}>
      <div className={styles.loadingSpinner} />
    </div>
  )

  if (!session) {
    router.replace("/login")
    return null
  }

  const user = session.user as any
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN"

  return (
    <div className={styles.root}>

      {/* SIDEBAR */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed}`}>
        <div className={styles.sidebarHeader}>
          <svg viewBox="0 0 340 340" className={styles.sidebarLogo}>
            <path id="logo_path_1" d="M47.67 0h226.59v226.59H47.67z" />
            <path id="logo_path_2"
              d="M376.14 249.62H273.91l44.41-59.17-68.08-91.83V244H239V64.65l86.32 116.44 87.29-116.27V244h-11.22V98.46l-69.08 92Zm-79.78-11.22h57.5l-28.57-38.55Z"
              transform="translate(-164.86 -49.53)"
            />
          </svg>
          {sidebarOpen && (
            <div className={styles.sidebarBrand}>
              <span className={styles.sidebarBrandName}>Morelli</span>
              <span className={styles.sidebarBrandSub}>Engenharia</span>
            </div>
          )}
        </div>

        <nav className={styles.sidebarNav}>
          {NAV_ITEMS.map(item =>
            item.id === "employees" && !isAdmin ? null : (
              <button
                key={item.id}
                className={`${styles.navItem} ${activeNav === item.id ? styles.navItemActive : ""}`}
                onClick={() => setActiveNav(item.id)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            )
          )}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              {user?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            {sidebarOpen && (
              <div className={styles.userDetails}>
                <span className={styles.userName}>{user?.email}</span>
                <span className={styles.userRole}>{user?.role}</span>
              </div>
            )}
          </div>
          <button className={styles.signOutBtn} onClick={() => signOut({ callbackUrl: "/login" })}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {sidebarOpen && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className={`${styles.main} ${sidebarOpen ? styles.mainOpen : styles.mainClosed}`}>

        {/* TOPBAR */}
        <header className={styles.topbar}>
          <button className={styles.menuToggle} onClick={() => setSidebarOpen(!sidebarOpen)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className={styles.topbarTitle}>
            {NAV_ITEMS.find(i => i.id === activeNav)?.label}
          </div>
          <div className={styles.topbarRight}>
            <span className={styles.companyBadge}>{user?.companyName ?? "—"}</span>
            {isAdmin && (
              <button className={styles.newDocBtn} onClick={() => router.push("/register")}>
                + Novo Usuário
              </button>
            )}
          </div>
        </header>

        {/* CONTENT */}
        <div className={styles.content}>

          {/* VISÃO GERAL */}
          {activeNav === "overview" && (
            <>
              <div className={styles.greeting}>
                <h1 className={styles.greetingTitle}>
                  Bem-vindo, <span>{user?.companyName ?? user?.email}</span>
                </h1>
                <p className={styles.greetingSubtitle}>Aqui está o resumo de segurança da sua empresa.</p>
              </div>

              <div className={styles.metricsGrid}>
                {[
                  { label: "Documentos Concluídos", color: "Green",  icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", value: "—" },
                  { label: "Em Análise",             color: "Yellow", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",     value: "—" },
                  { label: "Pendentes",              color: "Orange", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z", value: "—" },
                  { label: "Funcionários",           color: "Teal",   icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", value: loadingEmployees ? "..." : employees.length },
                ].map(m => (
                  <div key={m.label} className={`${styles.metricCard} ${styles[`metric${m.color}`]}`}>
                    <div className={styles.metricIcon}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d={m.icon} />
                      </svg>
                    </div>
                    <div className={styles.metricValue}>{m.value}</div>
                    <div className={styles.metricLabel}>{m.label}</div>
                  </div>
                ))}
              </div>

              <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                  <h2 className={styles.tableTitle}>Documentos Recentes</h2>
                  <button className={styles.viewAllBtn} onClick={() => setActiveNav("documents")}>
                    Ver todos →
                  </button>
                </div>
                <div className={styles.emptyState}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>Nenhum documento cadastrado ainda.</p>
                </div>
              </div>
            </>
          )}

          {/* DOCUMENTOS */}
          {activeNav === "documents" && <DocumentsSection />}

          {/* FUNCIONÁRIOS */}
          {activeNav === "employees" && (
            <div className={styles.tableCard}>
              <div className={styles.tableHeader}>
                <h2 className={styles.tableTitle}>Funcionários</h2>
                <button className={styles.newDocBtn} onClick={() => router.push("/register")}>
                  + Cadastrar
                </button>
              </div>

              {employeeError && (
                <div className={styles.errorBanner}>{employeeError}</div>
              )}

              {loadingEmployees ? (
                <div className={styles.emptyState}>
                  <div className={styles.loadingSpinner} />
                  <p>Carregando funcionários...</p>
                </div>
              ) : employees.length === 0 ? (
                <div className={styles.emptyState}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p>Nenhum funcionário cadastrado ainda.</p>
                </div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Nome / E-mail</th>
                      <th>Cargo</th>
                      <th>Cadastrado em</th>
                      {isAdmin && <th>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id}>
                        <td>
                          <div className={styles.employeeCell}>
                            <div className={styles.employeeAvatar}>
                              {emp.email[0].toUpperCase()}
                            </div>
                            <div>
                              <div className={styles.employeeName}>
                                {emp.name ?? "—"}
                              </div>
                              <div className={styles.employeeEmail}>{emp.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`${styles.roleBadge} ${styles[`role${emp.role}`]}`}>
                            {ROLE_LABEL[emp.role] ?? emp.role}
                          </span>
                        </td>
                        <td className={styles.docDate}>
                          {new Date(emp.createdAt).toLocaleDateString("pt-BR")}
                        </td>
                        {isAdmin && (
                          <td>
                            <button
                              className={styles.deleteBtn}
                              onClick={() => handleDelete(emp.id)}
                              disabled={deletingId === emp.id || emp.id === user?.id}
                              title={emp.id === user?.id ? "Você não pode remover a si mesmo" : "Remover usuário"}
                            >
                              {deletingId === emp.id ? "..." : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* IA */}
          {activeNav === "ai" && (
            <div className={styles.aiSection}>
              <div className={styles.aiCard}>
                <div className={styles.aiIcon}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h2 className={styles.aiTitle}>Análise Inteligente de Documentos</h2>
                <p className={styles.aiDesc}>
                  Faça upload de laudos técnicos, PGR ou PCMSO e nossa IA identifica automaticamente
                  direitos trabalhistas como insalubridade e periculosidade, além de inconsistências
                  com as Normas Regulamentadoras vigentes.
                </p>
                <div className={styles.aiUpload}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span>Arraste um documento ou clique para fazer upload</span>
                  <span className={styles.aiUploadSub}>PDF, DOCX até 20MB</span>
                </div>
                <button className={styles.aiBtn}>Analisar Documento</button>
              </div>
            </div>
          )}

          {/* RELATÓRIOS */}
          {activeNav === "reports" && (
            <div className={styles.comingSoon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h2>Em desenvolvimento</h2>
              <p>Os relatórios estarão disponíveis em breve.</p>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}