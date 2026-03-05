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
    take: 50, // últimas 50 mensagens
  })

  return NextResponse.json(messages)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const companyId = (session.user as any)?.companyId

  const { message } = await req.json()

  if (!message?.trim()) {
    return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 })
  }

  try {
    // Busca histórico recente
    const history = await prisma.chatMessage.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { role: true, content: true },
    })

    const answer = await chatWithAI(companyId, message, history)

    return NextResponse.json({ answer })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro ao processar mensagem." }, { status: 500 })
  }
}