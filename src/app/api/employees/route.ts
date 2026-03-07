import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../lib/auth"
import { prisma } from "../../../lib/prisma"
import { isValidUUID } from "../../../lib/ai-service"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const companyId = (session.user as any)?.companyId
  if (!companyId) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 403 })

  try {
    const users = await prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(users)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro ao buscar funcionários." }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const role = (session.user as any)?.role
  const companyId = (session.user as any)?.companyId
  const currentUserId = (session.user as any)?.id

  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Apenas administradores podem remover usuários." }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 })
  }

  const { id } = body

  if (!id || !isValidUUID(id)) {
    return NextResponse.json({ error: "ID de usuário inválido." }, { status: 400 })
  }

  // Impede que o admin remova a si mesmo
  if (id === currentUserId) {
    return NextResponse.json({ error: "Você não pode remover sua própria conta." }, { status: 403 })
  }

  try {
    const user = await prisma.user.findFirst({ where: { id, companyId } })

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 })
    }

    await prisma.user.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro ao remover usuário." }, { status: 500 })
  }
}