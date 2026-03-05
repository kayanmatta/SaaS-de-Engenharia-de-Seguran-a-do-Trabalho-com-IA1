import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../../lib/auth"
import { prisma } from "../../../../lib/prisma"
import { processDocument } from "../../../../lib/ai-service"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const companyId = (session.user as any)?.companyId
  const { documentId } = await req.json()

  if (!documentId) {
    return NextResponse.json({ error: "documentId é obrigatório." }, { status: 400 })
  }

  try {
    // Busca o documento no banco
    const document = await prisma.document.findFirst({
      where: { id: documentId, companyId },
    })

    if (!document || !document.fileUrl) {
      return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 })
    }

    // Marca como em análise
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "EM_ANALISE" },
    })

    // Baixa o arquivo do Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(document.fileUrl)

    if (downloadError || !fileData) {
      throw new Error("Erro ao baixar arquivo do storage.")
    }

    const buffer = Buffer.from(await fileData.arrayBuffer())

    // Processa com IA (extrai texto, chunka, analisa, atualiza perfil)
    const analysis = await processDocument(
      documentId,
      companyId,
      buffer,
      document.type,
      document.title
    )

    return NextResponse.json({ success: true, analysis })
  } catch (e: any) {
    console.error(e)

    // Volta status para PENDENTE em caso de erro
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "PENDENTE" },
    }).catch(() => {})

    return NextResponse.json({ error: e.message || "Erro ao processar documento." }, { status: 500 })
  }
}