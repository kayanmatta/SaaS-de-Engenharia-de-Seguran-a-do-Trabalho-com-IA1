import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../../../lib/auth"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) return NextResponse.json({ error: "Nenhum arquivo." }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const pdfParse = require("pdf-parse/lib/pdf-parse.js")

    // Tenta extrair com pdfjs primeiro
    let text = ""
    try {
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as any)
      pdfjsLib.GlobalWorkerOptions.workerSrc = false

      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        disableWorker: true,
        isEvalSupported: false,
        useSystemFonts: true,
        verbosity: 0,
      } as any).promise

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        text += content.items.map((item: any) => item.str ?? "").join(" ") + "\n"
      }
    } catch {
      // fallback vazio
      text = "Não foi possível extrair o texto deste PDF."
    }

    return NextResponse.json({ text: text.trim() })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Erro ao processar arquivo." }, { status: 500 })
  }
}