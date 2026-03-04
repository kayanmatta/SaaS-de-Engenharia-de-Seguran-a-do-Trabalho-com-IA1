import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../lib/auth"
import { prisma } from "../../../lib/prisma"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Chave secreta de serviço
)

// GET — lista documentos com URLs seguras (Signed URLs)
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

    // Gera uma URL assinada para cada documento
    // Isso resolve o erro 404 e garante que o link funcione por 1 hora
const docsWithSecureLinks = await Promise.all(
  documents.map(async (doc) => {
    // Adicionamos uma verificação simples antes de pedir a URL
    if (!doc.fileUrl) return doc;

    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.fileUrl, 3600) // 3600 segundos = 1 hora

    return {
      ...doc,
      fileUrl: data?.signedUrl || null,
    }
  })
)

    return NextResponse.json(docsWithSecureLinks)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro ao buscar documentos." }, { status: 500 })
  }
}

// POST — faz upload e salva o CAMINHO do arquivo
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const companyId = (session.user as any)?.companyId

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File
    const title = formData.get("title") as string
    const type = formData.get("type") as string
    const expiresAt = formData.get("expiresAt") as string

    // 1. Gerar nome e caminho únicos
    const fileExtension = file.name.split('.').pop()
    const fileName = `${crypto.randomUUID()}.${fileExtension}`
    const filePath = `${companyId}/${fileName}` // Pasta da empresa/UUID.pdf

    // 2. Upload para o Supabase Storage
    const { error: storageError } = await supabase.storage
      .from("documents")
      .upload(filePath, file)

    if (storageError) {
      console.error("Storage Error:", storageError)
      return NextResponse.json({ error: "Erro no upload do arquivo" }, { status: 500 })
    }

    // 3. Salva no banco o filePath (caminho) e não a URL pública
    const document = await prisma.document.create({
      data: {
        title,
        type: type as any,
        status: "PENDENTE",
        fileUrl: filePath, // IMPORTANTE: salvamos o caminho para gerar SignedURLs no GET
        fileName: file.name,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        companyId,
      },
    })

    return NextResponse.json(document, { status: 201 })
  } catch (e) {
    console.error("Server Error:", e)
    return NextResponse.json({ error: "Erro ao cadastrar documento." }, { status: 500 })
  }
}