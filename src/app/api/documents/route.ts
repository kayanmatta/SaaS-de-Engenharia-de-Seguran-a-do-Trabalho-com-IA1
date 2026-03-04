import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../lib/auth"
import { prisma } from "../../../lib/prisma"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // chave de serviço (não a pública)
)

// GET — lista documentos da empresa
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const companyId = (session.user as any)?.companyId

  try {
    const documents = await prisma.document.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(documents)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro ao buscar documentos." }, { status: 500 })
  }
}

// POST — faz upload do arquivo e cadastra o documento
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const companyId = (session.user as any)?.companyId

  try {
    const formData = await req.formData()

    const file      = formData.get("file") as File
    const title     = formData.get("title") as string
    const type      = formData.get("type") as string
    const expiresAt = formData.get("expiresAt") as string

    if (!file || !title || !type) {
      return NextResponse.json({ error: "Arquivo, título e tipo são obrigatórios." }, { status: 400 })
    }

    // Faz upload para o Supabase Storage
    const fileExt  = file.name.split(".").pop()
    const fileName = `${companyId}/${Date.now()}.${fileExt}`
    const buffer   = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error(uploadError)
      return NextResponse.json({ error: "Erro ao fazer upload do arquivo." }, { status: 500 })
    }

    // Gera URL pública do arquivo
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(fileName)

    // Salva no banco
    const document = await prisma.document.create({
      data: {
        title,
        type: type as any,
        status: "PENDENTE",
        fileUrl: urlData.publicUrl,
        fileName: file.name,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        companyId,
      },
    })

    return NextResponse.json(document, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro ao cadastrar documento." }, { status: 500 })
  }
}