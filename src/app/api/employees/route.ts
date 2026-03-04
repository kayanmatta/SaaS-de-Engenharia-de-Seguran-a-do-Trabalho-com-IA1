import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "../../../lib/prisma"

export async function GET() {
  const session = await getServerSession()

  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const companyId = (session.user as any)?.companyId

  if (!companyId) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 400 })
  }

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
  const session = await getServerSession()

  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const role = (session.user as any)?.role
  const companyId = (session.user as any)?.companyId

  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Apenas administradores podem remover usuários." }, { status: 403 })
  }

  const { id } = await req.json()

  if (!id) {
    return NextResponse.json({ error: "ID do usuário não fornecido." }, { status: 400 })
  }

  try {
    // Garante que só remove usuário da mesma empresa
    const user = await prisma.user.findFirst({
      where: { id, companyId },
    })

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