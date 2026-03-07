import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../lib/auth"
import { prisma } from "../../../lib/prisma"
import { processDocument, isValidUUID } from "../../../lib/ai-service"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Lock em memória para evitar análise duplicada simultânea ─────────────────
const processingLock = new Set<string>()

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const companyId = (session.user as any)?.companyId
  if (!companyId) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 403 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 })
  }

  const { documentId } = body

  // Valida UUID
  if (!documentId || !isValidUUID(documentId)) {
    return NextResponse.json({ error: "ID de documento inválido." }, { status: 400 })
  }

  // ─── Race condition protection ────────────────────────────────────────────
  if (processingLock.has(documentId)) {
    return NextResponse.json({ error: "Documento já está sendo analisado." }, { status: 409 })
  }

  // Verifica se documento pertence à empresa
  const document = await prisma.document.findFirst({
    where: { id: documentId, companyId },
  })

  if (!document) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 })
  }

  // Evita re-análise de documento já concluído
  if (document.status === "CONCLUIDO") {
    return NextResponse.json({ message: "Documento já foi analisado." }, { status: 200 })
  }

  // Adiciona lock
  processingLock.add(documentId)

  try {
    // Atualiza status para EM_ANALISE
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "EM_ANALISE" },
    })

    // Baixa arquivo do Supabase
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(document.fileUrl!)

    if (downloadError || !fileData) {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "PENDENTE" },
      })
      return NextResponse.json({ error: "Erro ao baixar arquivo." }, { status: 500 })
    }

    const buffer = Buffer.from(await fileData.arrayBuffer())

    // Processa com IA
    await processDocument(
      documentId,
      companyId,
      buffer,
      document.type,
      document.title
    )

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("Erro na análise:", e)

    // Reverte status em caso de erro
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "PENDENTE" },
    }).catch(() => {})

    return NextResponse.json({ error: "Erro ao analisar documento." }, { status: 500 })
  } finally {
    // Sempre remove o lock
    processingLock.delete(documentId)
  }
}