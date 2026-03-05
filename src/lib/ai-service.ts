import Groq from "groq-sdk"
import { prisma } from "./prisma"
import path from "path"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const MODEL = "llama-3.3-70b-versatile"

// ─── 1. EXTRAI TEXTO DO PDF ───────────────────────────────────────────────────
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Importação dinâmica do PDF.js (versão legacy para melhor compatibilidade com Node)
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as any)

  // CORREÇÃO: Define o caminho do worker usando o sistema de arquivos do servidor
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
    
    // Otimizado para garantir espaços entre os itens de texto
    const pageText = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ")
    
    fullText += pageText + "\n"
  }

  return fullText
}

// ─── 2. DIVIDE EM CHUNKS ─────────────────────────────────────────────────────
export function splitIntoChunks(text: string, chunkSize = 800, overlap = 100): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push(text.slice(start, end).trim())
    start += chunkSize - overlap
  }
  return chunks.filter(c => c.length > 50)
}

// ─── 3. EMBEDDING SIMPLES (busca por palavras-chave) ─────────────────────────
export function simpleEmbedding(text: string): number[] {
  const keywords = [
    "insalubridade", "periculosidade", "ruído", "químico", "físico",
    "nr-15", "nr-6", "nr-9", "epi", "risco", "exposição", "limite",
    "tolerância", "pgr", "pcmso", "aso", "laudo", "adicional", "grau",
    "agente", "biológico", "ergonômico", "acidente", "solda", "poeira",
    "temperatura", "vibração", "radiação", "pressão", "eletricidade"
  ]
  return keywords.map(kw => text.toLowerCase().includes(kw) ? 1 : 0)
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  if (normA === 0 || normB === 0) return 0
  return dot / (normA * normB)
}

// ─── 4. PROCESSA DOCUMENTO COMPLETO ──────────────────────────────────────────
export async function processDocument(
  documentId: string,
  companyId: string,
  fileBuffer: Buffer,
  documentType: string,
  documentTitle: string
): Promise<string> {

  const fullText = await extractTextFromPDF(fileBuffer)

  if (!fullText || fullText.trim().length < 50) {
    throw new Error("Não foi possível extrair texto do documento. Verifique se o PDF não é apenas uma imagem.")
  }

  // Chunka e salva com embedding
  const chunks = splitIntoChunks(fullText)
  for (let i = 0; i < chunks.length; i++) {
    await prisma.documentChunk.create({
      data: {
        documentId,
        content: chunks[i],
        embedding: JSON.stringify(simpleEmbedding(chunks[i])),
        chunkIndex: i,
      },
    })
  }

  // Analisa com Groq
  const analysis = await analyzeDocument(fullText, documentType, documentTitle)

  // Salva análise e atualiza status
  await prisma.document.update({
    where: { id: documentId },
    data: { aiAnalysis: analysis, status: "CONCLUIDO" },
  })

  // Atualiza perfil da empresa
  await updateCompanyKnowledge(companyId, documentType, analysis)

  return analysis
}

// ─── 5. ANALISA O DOCUMENTO ───────────────────────────────────────────────────
async function analyzeDocument(
  text: string,
  documentType: string,
  documentTitle: string
): Promise<string> {

  // Prioriza o início e o fim do documento se for muito longo (comum em laudos de SST)
  const truncatedText = text.length > 8000 
    ? text.slice(0, 4000) + "\n[...]\n" + text.slice(-4000)
    : text

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: "Você é um especialista em Segurança do Trabalho brasileiro. Analise documentos técnicos de SST com precisão e objetividade."
      },
      {
        role: "user",
        content: `Analise o documento do tipo "${documentType}" chamado "${documentTitle}".

Extraia e estruture:
1. **Resumo executivo** (2-3 frases)
2. **Agentes de risco identificados** (físicos, químicos, biológicos, ergonômicos, acidentais)
3. **Insalubridade** — setores/funções afetados e grau (mínimo 10%, médio 20%, máximo 40%)
4. **Periculosidade** — se aplicável (30% do salário base)
5. **Normas Regulamentadoras aplicáveis**
6. **Recomendações prioritárias**

Documento:
${truncatedText}`
      }
    ],
    max_tokens: 1500,
  })

  return response.choices[0].message.content ?? "Análise não disponível."
}

// ─── 6. ATUALIZA CONHECIMENTO DA EMPRESA ─────────────────────────────────────
async function updateCompanyKnowledge(
  companyId: string,
  documentType: string,
  analysis: string
): Promise<void> {

  const existingKnowledge = await prisma.companyKnowledge.findMany({
    where: { companyId },
  })

  const existingText = existingKnowledge
    .map(k => `[${k.category}]: ${k.content}`)
    .join("\n")

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: "Você é um especialista em SST. Retorne APENAS JSON válido, sem markdown, sem explicações."
      },
      {
        role: "user",
        content: `Atualize o perfil SST da empresa com base no novo documento.

CONHECIMENTO ATUAL:
${existingText || "Nenhum histórico ainda."}

NOVA ANÁLISE (${documentType}):
${analysis}

Retorne APENAS este JSON sem nenhum texto adicional:
{"setor_riscos":"...","insalubridade":"...","periculosidade":"...","nrs_aplicaveis":"...","perfil_empresa":"...","tendencias":"..."}`
      }
    ],
    max_tokens: 800,
  })

  const raw = response.choices[0].message.content ?? "{}"
  const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim()

  try {
    const knowledge = JSON.parse(clean)
    for (const [category, content] of Object.entries(knowledge)) {
      const existing = existingKnowledge.find(k => k.category === category)
      if (existing) {
        await prisma.companyKnowledge.update({
          where: { id: existing.id },
          data: { content: content as string },
        })
      } else {
        await prisma.companyKnowledge.create({
          data: { companyId, category, content: content as string },
        })
      }
    }
  } catch (e) {
    console.error("Erro ao parsear knowledge:", clean)
  }
}

// ─── 7. BUSCA CHUNKS RELEVANTES (RAG) ────────────────────────────────────────
export async function findRelevantChunks(
  companyId: string,
  question: string,
  topK = 5
): Promise<string[]> {

  const questionEmbedding = simpleEmbedding(question)

  const chunks = await prisma.documentChunk.findMany({
    where: { document: { companyId } },
    select: {
      content: true,
      embedding: true,
      document: { select: { title: true, type: true } },
    },
  })

  const scored = chunks
    .filter(c => c.embedding)
    .map(c => ({
      content: c.content,
      title: c.document.title,
      type: c.document.type,
      score: cosineSimilarity(questionEmbedding, JSON.parse(c.embedding!)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  return scored.map(c => `[${c.type} — ${c.title}]\n${c.content}`)
}

// ─── 8. CHAT COM IA ──────────────────────────────────────────────────────────
export async function chatWithAI(
  companyId: string,
  question: string,
  chatHistory: { role: string; content: string }[]
): Promise<string> {

  const relevantChunks = await findRelevantChunks(companyId, question)

  const knowledge = await prisma.companyKnowledge.findMany({
    where: { companyId },
  })

  const companyProfile = knowledge
    .map(k => `**${k.category}**: ${k.content}`)
    .join("\n")

  const systemPrompt = `Você é um assistente especialista em Segurança do Trabalho (SST) brasileiro, trabalhando exclusivamente para esta empresa.

PERFIL ACUMULADO DA EMPRESA:
${companyProfile || "Nenhum documento analisado ainda. Oriente o usuário a enviar documentos na aba Documentos."}

TRECHOS RELEVANTES DOS DOCUMENTOS:
${relevantChunks.join("\n\n---\n\n") || "Nenhum trecho relevante encontrado nos documentos."}

INSTRUÇÕES:
- Responda sempre em português do Brasil
- Seja preciso e técnico, cite NRs quando relevante  
- Use o perfil da empresa para personalizar as respostas
- Se não tiver informação suficiente nos documentos, diga claramente
- Quando identificar riscos, sempre mencione as medidas de controle adequadas`

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...chatHistory.slice(-10).map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: question },
  ]

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: 1000,
  })

  const answer = response.choices[0].message.content ?? "Não consegui processar sua pergunta."

  // Salva no histórico
  await prisma.chatMessage.createMany({
    data: [
      { companyId, role: "user",       content: question },
      { companyId, role: "assistant", content: answer   },
    ],
  })

  return answer
}