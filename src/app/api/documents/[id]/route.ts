import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../../lib/auth"
import { prisma } from "../../../../lib/prisma"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── EDITAR DOCUMENTO ────────────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const companyId = (session.user as any)?.companyId
  const { id } = await params

  const body = await req.json()
  const { title, type, status, expiresAt } = body

  const doc = await prisma.document.findFirst({
    where: { id, companyId },
  })

  if (!doc) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 })

  const updated = await prisma.document.update({
    where: { id },
    data: {
      ...(title     && { title }),
      ...(type      && { type }),
      ...(status    && { status }),
      ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
    },
  })

  return NextResponse.json(updated)
}

// ─── EXCLUIR DOCUMENTO ────────────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const companyId = (session.user as any)?.companyId
  const { id } = await params

  const doc = await prisma.document.findFirst({
    where: { id, companyId },
  })

  if (!doc) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 })

  // Deleta arquivo do Supabase Storage
  if (doc.fileUrl) {
    await supabase.storage.from("documents").remove([doc.fileUrl])
  }

  // Deleta chunks e o documento (cascata pelo schema)
  await prisma.document.delete({ where: { id } })

  return NextResponse.json({ success: true })
}