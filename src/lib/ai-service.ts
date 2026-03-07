import Groq from "groq-sdk"
import { prisma } from "./prisma"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const MODEL = "llama-3.3-70b-versatile"

// ─── UUID validation ──────────────────────────────────────────────────────────
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str)
}

// ─────────────────────────────────────────────
// 1. EXTRAÇÃO DE TEXTO DO PDF
// ─────────────────────────────────────────────
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs")

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      disableWorker: true,
      isEvalSupported: false,
      useSystemFonts: true,
      verbosity: 0,
    } as any)

    const pdf = await loadingTask.promise
    let fullText = ""

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item: any) => (item.str ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
      fullText += `--- PÁGINA ${i} ---\n${pageText}\n\n`
    }

    return fullText.trim()
  } catch (error: any) {
    console.error("Erro detalhado na extração:", error)
    throw new Error(`Falha ao processar o PDF: ${error.message}`)
  }
}

// ─────────────────────────────────────────────
// 2. CHUNKING
// ─────────────────────────────────────────────
export function splitIntoChunks(
  text: string,
  chunkSize = 1800,
  overlap = 300
): string[] {
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    const chunk = text.slice(start, end).trim()
    if (chunk.length > 120) chunks.push(chunk)
    start += chunkSize - overlap
  }

  return chunks
}

// ─────────────────────────────────────────────
// 3. EMBEDDING MELHORADO (TF básico + contexto)
// ─────────────────────────────────────────────
const SST_KEYWORDS = [
  // Riscos gerais
  "risco", "perigo", "exposição", "agente", "nocivo", "limite", "tolerância",
  // Insalubridade
  "insalubridade", "adicional", "grau mínimo", "grau médio", "grau máximo",
  "10%", "20%", "40%", "nr-15", "agente insalubre",
  // Periculosidade
  "periculosidade", "inflamável", "explosivo", "eletricidade", "altura",
  "nr-16", "nr-35", "30%",
  // Riscos físicos
  "ruído", "calor", "frio", "vibração", "radiação", "pressão", "umidade",
  "dba", "db(a)", "temperatura",
  // Riscos químicos
  "fumos", "poeira", "névoa", "gás", "vapores", "químico", "sílica",
  "amianto", "benzeno", "manganês", "chumbo",
  // Riscos biológicos
  "biológico", "bactéria", "fungo", "vírus", "parasita",
  // Riscos ergonômicos
  "ergonômico", "postura", "repetitivo", "levantamento", "esforço",
  "lombar", "ler", "dort",
  // Acidentes
  "acidente", "máquina", "corte", "queda", "projeção", "choque",
  // Documentos
  "pgr", "pcmso", "aso", "ltcat", "laudo", "ppra", "pcmat",
  // NRs
  "nr-1", "nr-6", "nr-7", "nr-9", "nr-12", "nr-15", "nr-17", "nr-35",
  // EPIs/EPCs
  "epi", "epc", "protetor auricular", "máscara", "luva", "capacete",
  "controle", "proteção", "medida",
  // Setores
  "solda", "soldagem", "usinagem", "manutenção", "logística", "produção",
]

export function simpleEmbedding(text: string): number[] {
  const lower = text.toLowerCase()
  const words = lower.split(/\s+/)
  const totalWords = Math.max(words.length, 1)

  return SST_KEYWORDS.map(kw => {
    // Conta frequência do termo (TF simples)
    const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
    const matches = (lower.match(regex) || []).length
    // Normaliza pelo tamanho do texto (evita bias para textos longos)
    return Math.min(matches / totalWords * 100, 1)
  })
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0
  const dot = a.reduce((sum, val, i) => sum + val * (b[i] || 0), 0)
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  if (!normA || !normB) return 0
  return dot / (normA * normB)
}

// ─────────────────────────────────────────────
// 4. PROCESSAMENTO DO DOCUMENTO
// ─────────────────────────────────────────────
export async function processDocument(
  documentId: string,
  companyId: string,
  fileBuffer: Buffer,
  documentType: string,
  documentTitle: string
): Promise<string> {
  const fullText = await extractTextFromPDF(fileBuffer)

  if (!fullText || fullText.length < 100) {
    throw new Error("Não foi possível extrair texto do documento.")
  }

  const chunks = splitIntoChunks(fullText)

  // ✅ CORRIGIDO: usa createMany em batch em vez de loop com await
  await prisma.documentChunk.createMany({
    data: chunks.map((content, i) => ({
      documentId,
      content,
      embedding: JSON.stringify(simpleEmbedding(content)),
      chunkIndex: i,
    })),
  })

  const analysis = await analyzeDocument(fullText, documentType, documentTitle)

  await prisma.document.update({
    where: { id: documentId },
    data: { aiAnalysis: analysis, status: "CONCLUIDO" },
  })

  await updateCompanyKnowledge(companyId, documentType, analysis)

  return analysis
}

// ─────────────────────────────────────────────
// 5. ANÁLISE DO DOCUMENTO
// ─────────────────────────────────────────────
async function analyzeDocument(
  text: string,
  documentType: string,
  documentTitle: string
): Promise<string> {
  const truncated =
    text.length > 9000
      ? text.slice(0, 4500) + "\n...\n" + text.slice(-4500)
      : text

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `Você é um Engenheiro de Segurança do Trabalho especialista em documentos SST brasileiros.
Analise documentos como PGR, PCMSO, LTCAT e Laudos técnicos.
Seja técnico, preciso e objetivo.`,
      },
      {
        role: "user",
        content: `Analise o documento:

TÍTULO: ${documentTitle}
TIPO: ${documentType}

Extraia:
1. Resumo técnico
2. Setores ou atividades
3. Riscos ocupacionais (físicos, químicos, biológicos, ergonômicos, acidentes)
4. Agentes nocivos
5. Possível INSALUBRIDADE (setor, agente, grau)
6. Possível PERICULOSIDADE (inflamáveis, explosivos, eletricidade, altura)
7. Normas Regulamentadoras aplicáveis
8. Medidas de controle (EPC, EPI, administrativas)

DOCUMENTO:
${truncated}`,
      },
    ],
    max_tokens: 1500,
  })

  return response.choices[0].message.content ?? ""
}

// ─────────────────────────────────────────────
// 6. PERFIL DA EMPRESA
// ─────────────────────────────────────────────
async function updateCompanyKnowledge(
  companyId: string,
  documentType: string,
  analysis: string
): Promise<void> {
  const existing = await prisma.companyKnowledge.findMany({ where: { companyId } })
  const existingText = existing.map(k => `[${k.category}] ${k.content}`).join("\n")

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: "Responda APENAS JSON válido." },
      {
        role: "user",
        content: `Atualize o perfil SST da empresa.

CONHECIMENTO ATUAL:
${existingText || "nenhum"}

NOVA ANÁLISE:
${analysis}

Retorne JSON:
{"setor_riscos":"","insalubridade":"","periculosidade":"","nrs_aplicaveis":"","perfil_empresa":"","tendencias":[]}`,
      },
    ],
    max_tokens: 800,
  })

  const raw = response.choices[0].message.content ?? "{}"

  try {
    const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim()
    if (!clean.startsWith("{")) throw new Error("Resposta não é JSON")

    const data = JSON.parse(clean)

    // ✅ CORRIGIDO: upsert em vez de if/else separados
    for (const [category, content] of Object.entries(data)) {
      const existingCategory = existing.find(e => e.category === category)
      if (existingCategory) {
        await prisma.companyKnowledge.update({
          where: { id: existingCategory.id },
          data: { content: JSON.stringify(content) },
        })
      } else {
        await prisma.companyKnowledge.create({
          data: { companyId, category, content: JSON.stringify(content) },
        })
      }
    }
  } catch (err) {
    console.error("Erro parsing knowledge:", raw)
  }
}

// ─────────────────────────────────────────────
// 7. RAG — PAGINADO e com limite seguro
// ─────────────────────────────────────────────
export async function findRelevantChunks(
  companyId: string,
  question: string,
  topK = 8
): Promise<string[]> {
  const qEmbedding = simpleEmbedding(question)

  // ✅ CORRIGIDO: limita a 500 chunks para não explodir memória
  const chunks = await prisma.documentChunk.findMany({
    where: { document: { companyId } },
    select: {
      content: true,
      embedding: true,
      document: { select: { title: true, type: true } },
    },
    take: 500,
    orderBy: { chunkIndex: "asc" },
  })

  const scored = chunks
    .filter(c => c.embedding)
    .map(c => {
      let emb: number[] = []
      try {
        emb = typeof c.embedding === "string" ? JSON.parse(c.embedding) : c.embedding ?? []
      } catch { emb = [] }

      return {
        content: c.content,
        title: c.document.title,
        type: c.document.type,
        score: cosineSimilarity(qEmbedding, emb),
      }
    })
    .filter(c => c.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  return scored.map(c => `DOCUMENTO: ${c.title}\nTIPO: ${c.type}\n\n${c.content}`)
}

// ─────────────────────────────────────────────
// 8. CHAT
// ─────────────────────────────────────────────
export async function chatWithAI(
  companyId: string,
  question: string,
  chatHistory: { role: string; content: string }[],
  extraContext = ""
): Promise<string> {
  // Sanitiza a pergunta
  const safeQuestion = question.trim().slice(0, 2000)

  const relevantChunks = await findRelevantChunks(companyId, safeQuestion)

  const knowledge = await prisma.companyKnowledge.findMany({ where: { companyId } })
  const profile = knowledge.map(k => `${k.category}: ${k.content}`).join("\n")

  const systemPrompt = `Você é um Engenheiro de Segurança do Trabalho especialista em documentos SST.

Responda utilizando APENAS as informações dos documentos fornecidos.

REGRAS IMPORTANTES:
- Nunca invente informações
- Não faça suposições
- Se a informação não existir, diga claramente que não foi encontrada
- Cite sempre a fonte do documento

PERFIL DA EMPRESA:
${profile || "Nenhum documento analisado"}

${extraContext ? `CONTEXTO ADICIONAL (arquivo enviado no chat):\n${extraContext.slice(0, 6000)}` : ""}

DOCUMENTOS RELEVANTES:
${relevantChunks.join("\n\n---\n\n") || "Nenhum trecho relevante encontrado"}`

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...chatHistory.slice(-10).map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: safeQuestion },
  ]

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: 1000,
  })

  const answer = response.choices[0].message.content ?? "Não consegui processar sua pergunta."

  // ✅ CORRIGIDO: createMany em vez de dois creates separados
  await prisma.chatMessage.createMany({
    data: [
      { companyId, role: "user", content: safeQuestion },
      { companyId, role: "assistant", content: answer },
    ],
  })

  return answer
}