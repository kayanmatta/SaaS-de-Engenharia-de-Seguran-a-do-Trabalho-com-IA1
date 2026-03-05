import Groq from "groq-sdk"
import { prisma } from "./prisma"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const MODEL = "llama-3.3-70b-versatile"

//////////////////////////////////////////////////////////////////
// 1. EXTRAÇÃO DE TEXTO DO PDF
//////////////////////////////////////////////////////////////////

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {

  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as any)

  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve(
      "pdfjs-dist/legacy/build/pdf.worker.mjs"
    )
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  })

  const pdf = await loadingTask.promise

  let fullText = ""

  for (let i = 1; i <= pdf.numPages; i++) {

    const page = await pdf.getPage(i)
    const content = await page.getTextContent()

    const pageText = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")

    fullText += pageText + "\n"
  }

  return fullText
}

//////////////////////////////////////////////////////////////////
// 2. CHUNKING
//////////////////////////////////////////////////////////////////

export function splitIntoChunks(
  text: string,
  chunkSize = 900,
  overlap = 150
): string[] {

  const chunks: string[] = []

  let start = 0

  while (start < text.length) {

    const end = Math.min(start + chunkSize, text.length)

    const chunk = text.slice(start, end).trim()

    if (chunk.length > 80) chunks.push(chunk)

    start += chunkSize - overlap
  }

  return chunks
}

//////////////////////////////////////////////////////////////////
// 3. EMBEDDING SIMPLES
//////////////////////////////////////////////////////////////////

export function simpleEmbedding(text: string): number[] {

  const keywords = [
    "insalubridade","periculosidade","ruído","químico","físico",
    "nr-15","nr-6","nr-9","epi","risco","exposição","limite",
    "tolerância","pgr","pcmso","aso","laudo","adicional","grau",
    "agente","biológico","ergonômico","acidente","solda","poeira",
    "temperatura","vibração","radiação","pressão","eletricidade",
    "fumos","metal","calor","frio","iluminação","ergonomia"
  ]

  const lower = text.toLowerCase()

  return keywords.map(k => lower.includes(k) ? 1 : 0)
}

function cosineSimilarity(a: number[], b: number[]): number {

  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0)

  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))

  if (!normA || !normB) return 0

  return dot / (normA * normB)
}

//////////////////////////////////////////////////////////////////
// 4. PROCESSAMENTO DO DOCUMENTO
//////////////////////////////////////////////////////////////////

export async function processDocument(
  documentId: string,
  companyId: string,
  fileBuffer: Buffer,
  documentType: string,
  documentTitle: string
): Promise<string> {

  const fullText = await extractTextFromPDF(fileBuffer)

  if (!fullText || fullText.length < 80) {
    throw new Error("Não foi possível extrair texto do documento.")
  }

  const chunks = splitIntoChunks(fullText)

  for (let i = 0; i < chunks.length; i++) {

    const embedding = simpleEmbedding(chunks[i])

    await prisma.documentChunk.create({
      data: {
        documentId,
        content: chunks[i],
        embedding: JSON.stringify(embedding),
        chunkIndex: i
      }
    })
  }

  const analysis = await analyzeDocument(fullText, documentType, documentTitle)

  await prisma.document.update({
    where: { id: documentId },
    data: {
      aiAnalysis: analysis,
      status: "CONCLUIDO"
    }
  })

  await updateCompanyKnowledge(companyId, documentType, analysis)

  return analysis
}

//////////////////////////////////////////////////////////////////
// 5. ANÁLISE DO DOCUMENTO
//////////////////////////////////////////////////////////////////

async function analyzeDocument(
  text: string,
  documentType: string,
  documentTitle: string
): Promise<string> {

  const truncated =
    text.length > 9000
      ? text.slice(0, 4500) + "\n[...]\n" + text.slice(-4500)
      : text

  const response = await groq.chat.completions.create({

    model: MODEL,

    messages: [

      {
        role: "system",
        content: `
Você é um Engenheiro de Segurança do Trabalho especialista em análise documental.

Analise documentos como:

- PGR
- LTCAT
- PCMSO
- Laudos de Insalubridade
- Laudos de Periculosidade
- APR
- Ordens de Serviço

REGRAS:

• Nunca invente informações
• Use somente o conteúdo do documento
• Se algo não existir diga: "O documento não apresenta essa informação."
• Cite setores quando possível
• Cite normas regulamentadoras quando aplicável
`
      },

      {
        role: "user",
        content: `
Analise o documento abaixo.

Documento: ${documentTitle}
Tipo: ${documentType}

Extraia:

1. Resumo executivo
2. Setores identificados
3. Riscos físicos
4. Riscos químicos
5. Riscos biológicos
6. Riscos ergonômicos
7. Riscos de acidente
8. Situações de insalubridade
9. Situações de periculosidade
10. Normas regulamentadoras citadas
11. Recomendações de segurança

Documento:

${truncated}
`
      }
    ],

    max_tokens: 1500
  })

  return response.choices[0].message.content ?? ""
}

//////////////////////////////////////////////////////////////////
// 6. PERFIL DE CONHECIMENTO DA EMPRESA
//////////////////////////////////////////////////////////////////

async function updateCompanyKnowledge(
  companyId: string,
  documentType: string,
  analysis: string
): Promise<void> {

  const existing = await prisma.companyKnowledge.findMany({
    where: { companyId }
  })

  const existingText = existing
    .map(k => `[${k.category}] ${k.content}`)
    .join("\n")

  const response = await groq.chat.completions.create({

    model: MODEL,

    messages: [

      {
        role: "system",
        content: `
Você é um especialista em SST.

Responda APENAS JSON válido.

Não use markdown.
Não explique nada.
`
      },

      {
        role: "user",
        content: `
Atualize o perfil de risco da empresa.

CONHECIMENTO ATUAL:
${existingText || "nenhum"}

NOVA ANÁLISE:
${analysis}

Retorne:

{
"setor_riscos":"",
"insalubridade":"",
"periculosidade":"",
"nrs_aplicaveis":"",
"perfil_empresa":"",
"tendencias":[]
}
`
      }
    ],

    max_tokens: 800
  })

  const raw = response.choices[0].message.content ?? "{}"

  try {

    const clean = raw.replace(/```json/g, "").replace(/```/g, "")

    const data = JSON.parse(clean)

    for (const [category, content] of Object.entries(data)) {

      const existingCategory = existing.find(e => e.category === category)

      if (existingCategory) {

        await prisma.companyKnowledge.update({
          where: { id: existingCategory.id },
          data: { content: JSON.stringify(content) }
        })

      } else {

        await prisma.companyKnowledge.create({
          data: {
            companyId,
            category,
            content: JSON.stringify(content)
          }
        })
      }
    }

  } catch (err) {
    console.error("Erro parsing knowledge:", raw)
  }
}

//////////////////////////////////////////////////////////////////
// 7. BUSCA RAG
//////////////////////////////////////////////////////////////////

export async function findRelevantChunks(
  companyId: string,
  question: string,
  topK = 8
): Promise<string[]> {

  const qEmbedding = simpleEmbedding(question)

  const chunks = await prisma.documentChunk.findMany({
    where: { document: { companyId } },
    select: {
      content: true,
      embedding: true,
      document: { select: { title: true, type: true } }
    }
  })

  const scored = chunks
    .filter(c => c.embedding)
    .map(c => ({

      content: c.content,
      title: c.document.title,
      type: c.document.type,

      score: cosineSimilarity(
        qEmbedding,
        JSON.parse(c.embedding!)
      )
    }))
    .sort((a, b) => b.score - a.score)

  const filtered = scored.filter(c => c.score > 0.15).slice(0, topK)

  return filtered.map(c => `
DOCUMENTO: ${c.title}
TIPO: ${c.type}

TRECHO:
${c.content}
`)
}

//////////////////////////////////////////////////////////////////
// 8. CHAT
//////////////////////////////////////////////////////////////////

export async function chatWithAI(
  companyId: string,
  question: string,
  chatHistory: { role: string; content: string }[]
): Promise<string> {

  const relevantChunks = await findRelevantChunks(companyId, question)

  const knowledge = await prisma.companyKnowledge.findMany({
    where: { companyId }
  })

  const profile = knowledge
    .map(k => `${k.category}: ${k.content}`)
    .join("\n")

  const systemPrompt = `
Você é um assistente especialista em Segurança do Trabalho no Brasil.

Use os documentos da empresa para responder.

REGRAS:

• Não invente dados
• Baseie-se nos documentos
• Cite normas quando possível
• Sugira medidas de controle quando houver riscos
• Se a informação não existir diga:
"O documento não apresenta essa informação."

PERFIL DA EMPRESA:

${profile || "Nenhum documento analisado ainda."}

DOCUMENTOS RELEVANTES:

${relevantChunks.join("\n\n---\n\n") || "Nenhum trecho relevante encontrado."}
`

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [

    { role: "system", content: systemPrompt },

    ...chatHistory.slice(-10).map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content
    })),

    { role: "user", content: question }
  ]

  const response = await groq.chat.completions.create({

    model: MODEL,
    messages,
    max_tokens: 1000
  })

  const answer =
    response.choices[0].message.content ??
    "Não consegui processar sua pergunta."

  await prisma.chatMessage.createMany({
    data: [
      { companyId, role: "user", content: question },
      { companyId, role: "assistant", content: answer }
    ]
  })

  return answer
}