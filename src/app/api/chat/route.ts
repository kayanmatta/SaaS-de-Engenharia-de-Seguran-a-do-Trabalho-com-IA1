import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../lib/auth"
import { prisma } from "../../../lib/prisma"
import { chatWithAI } from "../../../lib/ai-service"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const companyId = (session.user as any)?.companyId

  const messages = await prisma.chatMessage.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    take: 50,
  })

  return NextResponse.json(messages)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const companyId = (session.user as any)?.companyId

  const { message, documentId, tempFileText, tempFileName } = await req.json()

  if (!message?.trim()) {
    return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 })
  }

  try {
    const history = await prisma.chatMessage.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { role: true, content: true },
    })

    // Monta contexto extra dependendo do modo
    let extraContext = ""

    if (documentId) {
      // Modo: documento salvo selecionado — busca chunks específicos desse doc
      const chunks = await prisma.documentChunk.findMany({
        where: { documentId, document: { companyId } },
        orderBy: { chunkIndex: "asc" },
        take: 10,
        select: { content: true },
      })

      const doc = await prisma.document.findFirst({
        where: { id: documentId, companyId },
        select: { title: true, type: true, aiAnalysis: true },
      })

      if (doc) {
        extraContext = `
O usuário está perguntando especificamente sobre o documento:
TÍTULO: ${doc.title}
TIPO: ${doc.type}

ANÁLISE PRÉVIA DA IA:
${doc.aiAnalysis ?? "Não analisado ainda."}

TRECHOS DO DOCUMENTO:
${chunks.map(c => c.content).join("\n\n")}
`
      }
    } else if (tempFileText) {
      // Modo: arquivo temporário enviado no chat
      const isImage = tempFileText.startsWith("data:image")

      extraContext = isImage
        ? `O usuário enviou uma imagem chamada "${tempFileName}" para análise. Descreva o que vê e analise do ponto de vista de SST.`
        : `O usuário enviou um arquivo temporário chamado "${tempFileName}" com o seguinte conteúdo:\n\n${tempFileText.slice(0, 8000)}`
    }

    const answer = await chatWithAI(companyId, message, history, extraContext)

    return NextResponse.json({ answer })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro ao processar mensagem." }, { status: 500 })
  }
}