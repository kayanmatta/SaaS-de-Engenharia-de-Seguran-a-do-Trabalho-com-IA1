'use client'

import { useEffect, useState } from "react"
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from "recharts"
import styles from "./reports.module.css"

type ReportData = {
  total: number
  statusCount: Record<string, number>
  typeCount: Record<string, number>
  byMonth: Record<string, number>
  expiring: { d30: number; d60: number; d90: number }
  expired: number
  alerts: {
    id: string; title: string; type: string
    status: string; expiresAt: string; urgency: string
  }[]
  risks: { name: string; count: number }[]
  knowledge: { category: string; content: string }[]
}

const STATUS_COLORS: Record<string, string> = {
  CONCLUIDO:  "#00a79d",
  PENDENTE:   "#f97316",
  EM_ANALISE: "#f59e0b",
  VENCIDO:    "#ef4444",
}

const STATUS_LABEL: Record<string, string> = {
  CONCLUIDO:  "Concluído",
  PENDENTE:   "Pendente",
  EM_ANALISE: "Em Análise",
  VENCIDO:    "Vencido",
}

const TYPE_LABEL: Record<string, string> = {
  PGR: "PGR", PCMSO: "PCMSO", ASO: "ASO", CLCB: "CLCB",
  LAUDO_INSALUBRIDADE: "L. Insalub.", LAUDO_PERICULOSIDADE: "L. Periculosidade",
  RELATORIO_TECNICO: "Rel. Técnico", TLCAT: "TLCAT",
}

const KNOWLEDGE_LABEL: Record<string, string> = {
  setor_riscos:   "Setores e Riscos",
  insalubridade:  "Insalubridade",
  periculosidade: "Periculosidade",
  nrs_aplicaveis: "NRs Aplicáveis",
  perfil_empresa: "Perfil da Empresa",
  tendencias:     "Tendências",
}

export default function ReportsSection() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/reports")
      .then(r => r.json())
      .then(setData)
      .catch(() => setError("Erro ao carregar relatórios."))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className={styles.center}>
      <div className={styles.spinner} />
    </div>
  )

  if (error || !data) return (
    <div className={styles.center}>
      <p className={styles.errorText}>{error || "Sem dados."}</p>
    </div>
  )

  if (data.total === 0) return (
    <div className={styles.center}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" width="48" height="48" style={{ color: "#c4b0a0" }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p style={{ color: "#8a7060", marginTop: "1rem" }}>Envie documentos para gerar relatórios.</p>
    </div>
  )

  // Prepara dados para gráficos
  const statusData = Object.entries(data.statusCount)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: STATUS_LABEL[k] ?? k, value: v, key: k }))

  const typeData = Object.entries(data.typeCount)
    .map(([k, v]) => ({ name: TYPE_LABEL[k] ?? k, value: v }))
    .sort((a, b) => b.value - a.value)

  const monthData = Object.entries(data.byMonth)
    .map(([k, v]) => ({ mes: k, docs: v }))

  const expiringData = [
    { name: "Vencidos",   value: data.expired,       fill: "#ef4444" },
    { name: "Até 30 dias", value: data.expiring.d30,  fill: "#f97316" },
    { name: "Até 60 dias", value: data.expiring.d60,  fill: "#f59e0b" },
    { name: "Até 90 dias", value: data.expiring.d90,  fill: "#00a79d" },
  ].filter(d => d.value > 0)

  return (
    <div className={styles.wrapper}>

      {/* ─── CARDS RESUMO ──────────────────────────────────────────────────── */}
      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Total de Documentos</span>
          <span className={styles.cardValue}>{data.total}</span>
        </div>
        <div className={`${styles.card} ${styles.cardGreen}`}>
          <span className={styles.cardLabel}>Concluídos</span>
          <span className={styles.cardValue}>{data.statusCount.CONCLUIDO ?? 0}</span>
        </div>
        <div className={`${styles.card} ${styles.cardOrange}`}>
          <span className={styles.cardLabel}>Pendentes</span>
          <span className={styles.cardValue}>{data.statusCount.PENDENTE ?? 0}</span>
        </div>
        <div className={`${styles.card} ${styles.cardRed}`}>
          <span className={styles.cardLabel}>Vencidos</span>
          <span className={styles.cardValue}>{data.expired}</span>
        </div>
      </div>

      {/* ─── ALERTAS ───────────────────────────────────────────────────────── */}
      {data.alerts.length > 0 && (
        <div className={styles.alertBox}>
          <div className={styles.alertHeader}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" width="18" height="18">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Atenção necessária — {data.alerts.length} documento{data.alerts.length > 1 ? "s" : ""}</span>
          </div>
          <div className={styles.alertList}>
            {data.alerts.map(doc => (
              <div key={doc.id} className={`${styles.alertItem} ${doc.urgency === "expired" ? styles.alertExpired : styles.alertSoon}`}>
                <div className={styles.alertInfo}>
                  <span className={styles.alertTitle}>{doc.title}</span>
                  <span className={styles.alertType}>{TYPE_LABEL[doc.type] ?? doc.type}</span>
                </div>
                <span className={styles.alertDate}>
                  {doc.urgency === "expired" ? "⚠ Vencido em " : "Vence em "}
                  {new Date(doc.expiresAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── GRÁFICOS ROW 1 ────────────────────────────────────────────────── */}
      <div className={styles.row}>

        {/* Pizza — Status */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Documentos por Status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {statusData.map((entry) => (
                  <Cell key={entry.key} fill={STATUS_COLORS[entry.key] ?? "#c4b0a0"} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className={styles.legend}>
            {statusData.map(s => (
              <div key={s.key} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: STATUS_COLORS[s.key] }} />
                <span>{s.name}</span>
                <span className={styles.legendVal}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pizza — Tipos */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Documentos por Tipo</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={typeData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {typeData.map((_, i) => (
                  <Cell key={i} fill={["#3a2419","#00a79d","#d4b99a","#f97316","#f59e0b","#8a7060","#00836d","#ef4444"][i % 8]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className={styles.legend}>
            {typeData.map((t, i) => (
              <div key={t.name} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: ["#3a2419","#00a79d","#d4b99a","#f97316","#f59e0b","#8a7060","#00836d","#ef4444"][i % 8] }} />
                <span>{t.name}</span>
                <span className={styles.legendVal}>{t.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Barra — Vencimentos */}
        {expiringData.length > 0 && (
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Vencimentos</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={expiringData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0e8e0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {expiringData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ─── GRÁFICOS ROW 2 ────────────────────────────────────────────────── */}
      <div className={styles.row}>

        {/* Linha — Envios por mês */}
        {monthData.length > 1 && (
          <div className={`${styles.chartCard} ${styles.chartCardWide}`}>
            <h3 className={styles.chartTitle}>Documentos Enviados por Mês</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthData} margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0e8e0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="docs" stroke="#00a79d" strokeWidth={2} dot={{ fill: "#00a79d", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Barra — Riscos da IA */}
        {data.risks.length > 0 && (
          <div className={`${styles.chartCard} ${styles.chartCardWide}`}>
            <h3 className={styles.chartTitle}>Riscos Identificados pela IA</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.risks.slice(0, 8)} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0e8e0" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                <Tooltip />
                <Bar dataKey="count" fill="#3a2419" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ─── PERFIL DA EMPRESA ─────────────────────────────────────────────── */}
      {data.knowledge.length > 0 && (
        <div className={styles.knowledgeCard}>
          <h3 className={styles.chartTitle}>Perfil SST da Empresa — Aprendizado da IA</h3>
          <div className={styles.knowledgeGrid}>
            {data.knowledge
              .filter(k => k.content && k.content !== '""' && k.content !== "[]")
              .map(k => (
                <div key={k.category} className={styles.knowledgeItem}>
                  <span className={styles.knowledgeLabel}>
                    {KNOWLEDGE_LABEL[k.category] ?? k.category}
                  </span>
                  <p className={styles.knowledgeText}>
                    {k.content.replace(/["\[\]]/g, "").slice(0, 300)}
                    {k.content.length > 300 ? "..." : ""}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

    </div>
  )
}