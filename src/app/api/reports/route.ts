import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../lib/auth"
import { prisma } from "../../../lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const companyId = (session.user as any)?.companyId

  const documents = await prisma.document.findMany({
    where: { companyId },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      aiAnalysis: true,
    },
    orderBy: { createdAt: "asc" },
  })

  const knowledge = await prisma.companyKnowledge.findMany({
    where: { companyId },
  })

  const now = new Date()
  const in30 = new Date(now); in30.setDate(in30.getDate() + 30)
  const in60 = new Date(now); in60.setDate(in60.getDate() + 60)
  const in90 = new Date(now); in90.setDate(in90.getDate() + 90)

  // ─── Status dos documentos ───────────────────────────────────────────────
  const statusCount = {
    CONCLUIDO:  documents.filter(d => d.status === "CONCLUIDO").length,
    PENDENTE:   documents.filter(d => d.status === "PENDENTE").length,
    EM_ANALISE: documents.filter(d => d.status === "EM_ANALISE").length,
    VENCIDO:    documents.filter(d => d.status === "VENCIDO").length,
  }

  // ─── Tipos de documentos ─────────────────────────────────────────────────
  const typeCount: Record<string, number> = {}
  documents.forEach(d => {
    typeCount[d.type] = (typeCount[d.type] || 0) + 1
  })

  // ─── Documentos por mês ──────────────────────────────────────────────────
  const byMonth: Record<string, number> = {}
  documents.forEach(d => {
    const key = new Date(d.createdAt).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    byMonth[key] = (byMonth[key] || 0) + 1
  })

  // ─── Vencimentos ─────────────────────────────────────────────────────────
  const expiring30 = documents.filter(d => d.expiresAt && new Date(d.expiresAt) <= in30 && new Date(d.expiresAt) >= now)
  const expiring60 = documents.filter(d => d.expiresAt && new Date(d.expiresAt) > in30 && new Date(d.expiresAt) <= in60)
  const expiring90 = documents.filter(d => d.expiresAt && new Date(d.expiresAt) > in60 && new Date(d.expiresAt) <= in90)
  const expired    = documents.filter(d => d.expiresAt && new Date(d.expiresAt) < now)

  // ─── Alertas prioritários (vencidos + vencendo em 30 dias) ───────────────
  const alerts = [
    ...expired.map(d => ({ ...d, urgency: "expired" })),
    ...expiring30.map(d => ({ ...d, urgency: "30days" })),
  ].sort((a, b) => new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime())

  // ─── Riscos identificados pela IA ────────────────────────────────────────
  const riskKeywords = [
    { key: "ruído",          label: "Ruído" },
    { key: "químico",        label: "Agente Químico" },
    { key: "fumo",           label: "Fumos Metálicos" },
    { key: "poeira",         label: "Poeira" },
    { key: "calor",          label: "Calor" },
    { key: "vibração",       label: "Vibração" },
    { key: "radiação",       label: "Radiação" },
    { key: "ergonôm",        label: "Ergonômico" },
    { key: "periculosidade", label: "Periculosidade" },
    { key: "insalubridade",  label: "Insalubridade" },
  ]

  const allAnalysis = documents.map(d => d.aiAnalysis ?? "").join(" ").toLowerCase()
  const risks = riskKeywords
    .map(r => ({
      name: r.label,
      count: (allAnalysis.match(new RegExp(r.key, "gi")) || []).length,
    }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count)

  return NextResponse.json({
    total: documents.length,
    statusCount,
    typeCount,
    byMonth,
    expiring: { d30: expiring30.length, d60: expiring60.length, d90: expiring90.length },
    expired: expired.length,
    alerts,
    risks,
    knowledge,
  })
}