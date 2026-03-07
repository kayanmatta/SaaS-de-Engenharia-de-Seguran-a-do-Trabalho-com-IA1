import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../lib/auth"
import { prisma } from "../../../lib/prisma"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Tipos e tamanhos permitidos ─────────────────────────────────────────────
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

const ALLOWED_DOC_TYPES = [
  "PGR", "PCMSO", "LAUDO_INSALUBRIDADE", "LAUDO_PERICULOSIDADE",
  "ASO", "CLCB", "RELATORIO_TECNICO", "TLCAT",
]

// ─── Sanitiza strings para evitar XSS ────────────────────────────────────────
function sanitize(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .trim()
    .slice(0, 255) // Limita tamanho máximo
}

// ─── GET — lista documentos com Signed URLs ───────────────────────────────────
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const companyId = (session.user as any)?.companyId
  if (!companyId) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 403 })

  try {
    const documents = await prisma.document.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    })

    const docsWithSecureLinks = await Promise.all(
      documents.map(async (doc) => {
        if (!doc.fileUrl) return doc

        const { data } = await supabase.storage
          .from("documents")
          .createSignedUrl(doc.fileUrl, 3600)

        return { ...doc, fileUrl: data?.signedUrl || null }
      })
    )

    return NextResponse.json(docsWithSecureLinks)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro ao buscar documentos." }, { status: 500 })
  }
}

// ─── POST — upload com validação completa ─────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  const companyId = (session.user as any)?.companyId
  if (!companyId) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 403 })

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const title = formData.get("title") as string | null
    const type = formData.get("type") as string | null
    const expiresAt = formData.get("expiresAt") as string | null

    // ─── Validações ──────────────────────────────────────────────────────────

    if (!file || !title || !type) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 })
    }

    // Valida tipo do documento
    if (!ALLOWED_DOC_TYPES.includes(type)) {
      return NextResponse.json({ error: "Tipo de documento inválido." }, { status: 400 })
    }

    // Valida MIME type do arquivo
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Tipo de arquivo não permitido. Use PDF ou DOC." }, { status: 400 })
    }

    // Valida tamanho
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Arquivo muito grande. Máximo 20MB." }, { status: 400 })
    }

    // Valida extensão do arquivo (dupla verificação)
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!["pdf", "doc", "docx"].includes(ext ?? "")) {
      return NextResponse.json({ error: "Extensão de arquivo não permitida." }, { status: 400 })
    }

    // Sanitiza inputs
    const safeTitle = sanitize(title)
    if (!safeTitle) {
      return NextResponse.json({ error: "Título inválido." }, { status: 400 })
    }

    // Valida data de vencimento
    let expiresAtDate: Date | null = null
    if (expiresAt) {
      expiresAtDate = new Date(expiresAt)
      if (isNaN(expiresAtDate.getTime())) {
        return NextResponse.json({ error: "Data de vencimento inválida." }, { status: 400 })
      }
    }

    // ─── Upload ──────────────────────────────────────────────────────────────

    const fileName = `${crypto.randomUUID()}.${ext}`
    const filePath = `${companyId}/${fileName}`

    const { error: storageError } = await supabase.storage
      .from("documents")
      .upload(filePath, file)

    if (storageError) {
      console.error("Storage Error:", storageError)
      return NextResponse.json({ error: "Erro no upload do arquivo." }, { status: 500 })
    }

    // ─── Salva no banco ───────────────────────────────────────────────────────

    const document = await prisma.document.create({
      data: {
        title: safeTitle,
        type: type as any,
        status: "PENDENTE",
        fileUrl: filePath,
        fileName: sanitize(file.name),
        expiresAt: expiresAtDate,
        companyId,
      },
    })

    return NextResponse.json(document, { status: 201 })
  } catch (e) {
    console.error("Server Error:", e)
    return NextResponse.json({ error: "Erro ao cadastrar documento." }, { status: 500 })
  }
}