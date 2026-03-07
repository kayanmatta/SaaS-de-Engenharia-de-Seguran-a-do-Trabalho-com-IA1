import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../lib/auth"
import { prisma } from "../../../lib/prisma"
import { chatWithAI, isValidUUID } from "../../../lib/ai-service"

const MAX_MESSAGE_LENGTH = 2000
const MAX_FILE_TEXT_LENGTH = 8000
const MAX_FILENAME_LENGTH = 255

function sanitizeString(str: string, maxLength: number): string {
  return str
    .replace(/[<>]/g, "") // remove tags HTML básicas
    .trim()
    .slice(0, maxLength)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const companyId = (session.user as any)?.companyId
  if (!companyId) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 403 })

  try {
    const messages = await prisma.chatMessage.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
      take: 50,
    })
    return NextResponse.json(messages)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro ao buscar histórico." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const companyId = (session.user as any)?.companyId
  if (!companyId) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 403 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 })
  }

  const { message, documentId, tempFileText, tempFileName } = body

  // ─── Validações de input ─────────────────────────────────────────────────
  if (!message?.trim()) {
    return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 })
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "Mensagem muito longa." }, { status: 400 })
  }

  // Valida documentId como UUID se fornecido
  if (documentId && !isValidUUID(documentId)) {
    return NextResponse.json({ error: "ID de documento inválido." }, { status: 400 })
  }

  // Sanitiza inputs
  const safeMessage  = sanitizeString(message, MAX_MESSAGE_LENGTH)
  const safeFileText = tempFileText ? sanitizeString(tempFileText, MAX_FILE_TEXT_LENGTH) : ""
  const safeFileName = tempFileName ? sanitizeString(tempFileName, MAX_FILENAME_LENGTH) : ""

  try {
    const history = await prisma.chatMessage.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { role: true, content: true },
    })

    let extraContext = ""

    if (documentId) {
      // Verifica se o documento pertence à empresa (segurança multi-tenant)
      const doc = await prisma.document.findFirst({
        where: { id: documentId, companyId },
        select: { title: true, type: true, aiAnalysis: true },
      })

      if (!doc) {
        return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 })
      }

      const chunks = await prisma.documentChunk.findMany({
        where: { documentId, document: { companyId } },
        orderBy: { chunkIndex: "asc" },
        take: 10,
        select: { content: true },
      })

      extraContext = `O usuário está perguntando especificamente sobre o documento:
TÍTULO: ${doc.title}
TIPO: ${doc.type}

ANÁLISE PRÉVIA DA IA:
${doc.aiAnalysis ?? "Não analisado ainda."}

TRECHOS DO DOCUMENTO:
${chunks.map(c => c.content).join("\n\n")}`

    } else if (safeFileText) {
      const isImage = safeFileText.startsWith("data:image")
      extraContext = isImage
        ? `O usuário enviou uma imagem chamada "${safeFileName}" para análise. Analise do ponto de vista de SST.`
        : `O usuário enviou um arquivo temporário chamado "${safeFileName}" com o seguinte conteúdo:\n\n${safeFileText}`
    }

    const answer = await chatWithAI(companyId, safeMessage, history, extraContext)

    return NextResponse.json({ answer })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro ao processar mensagem." }, { status: 500 })
  }
}