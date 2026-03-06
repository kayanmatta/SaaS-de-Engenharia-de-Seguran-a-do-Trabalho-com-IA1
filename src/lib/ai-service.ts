import Groq from "groq-sdk"
import { prisma } from "./prisma"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const MODEL = "llama-3.3-70b-versatile"


// ─────────────────────────────────────────────
// 1. EXTRAÇÃO DE TEXTO DO PDF
// ─────────────────────────────────────────────
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // 1. Importação específica para ambiente Node (Legacy)
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  try {
    // 2. Criamos o documento SEM definir workerSrc. 
    // O segredo é o 'disableWorker: true' e o 'verbosity: 0' para não poluir o console.
    const loadingTask = pdfjsLib.getDocument({
  data: new Uint8Array(buffer),
  disableWorker: true, // Força a execução na thread principal do Node
  isEvalSupported: false,
  useSystemFonts: true,
  verbosity: 0 
} as any);

    const pdf = await loadingTask.promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      
      // Mapeia o texto e remove espaços extras para economizar tokens na IA
      const pageText = content.items
        .map((item: any) => (item.str ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ");
        
      fullText += `--- PÁGINA ${i} ---\n${pageText}\n\n`;
    }

    return fullText.trim();
  } catch (error: any) {
    console.error("Erro detalhado na extração:", error);
    throw new Error(`Falha ao processar o PDF: ${error.message}`);
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

    if (chunk.length > 120) {
      chunks.push(chunk)
    }

    start += chunkSize - overlap
  }

  return chunks
}


// ─────────────────────────────────────────────
// 3. EMBEDDING SIMPLES
// ─────────────────────────────────────────────
export function simpleEmbedding(text: string): number[] {

  const keywords = [

    "risco","perigo","exposição","agente",

    "insalubridade","adicional","grau mínimo","grau médio","grau máximo",

    "periculosidade","inflamável","explosivo","eletricidade","altura",

    "ruído","calor","frio","vibração","radiação","pressão",

    "fumos","poeira","névoa","gás","vapores","químico",

    "biológico","bactéria","fungo","vírus",

    "ergonômico","postura","repetitivo","levantamento",

    "acidente","máquina","corte","queda",

    "pgr","pcmso","aso","ltcat","laudo",

    "nr-6","nr-9","nr-12","nr-15","nr-17","nr-35",

    "epi","epc","controle","proteção"
  ]

  const lower = text.toLowerCase()

  return keywords.map(k => lower.includes(k) ? 1 : 0)
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

  for (let i = 0; i < chunks.length; i++) {

    await prisma.documentChunk.create({
      data: {
        documentId,
        content: chunks[i],
        embedding: JSON.stringify(simpleEmbedding(chunks[i])),
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
        content: `
Você é um Engenheiro de Segurança do Trabalho especialista em documentos SST brasileiros.

Analise documentos como:
PGR
PCMSO
LTCAT
Laudos técnicos

Seja técnico, preciso e objetivo.
`
      },

      {
        role: "user",
        content: `

Analise o documento:

TÍTULO: ${documentTitle}
TIPO: ${documentType}

Extraia:

1. Resumo técnico

2. Setores ou atividades

3. Riscos ocupacionais:
- físicos
- químicos
- biológicos
- ergonômicos
- acidentes

4. Agentes nocivos

5. Possível INSALUBRIDADE
- setor
- agente
- grau

6. Possível PERICULOSIDADE
- inflamáveis
- explosivos
- eletricidade
- altura

7. Normas Regulamentadoras aplicáveis

8. Medidas de controle
- EPC
- EPI
- administrativas

DOCUMENTO:

${truncated}

`
      }
    ],

    max_tokens: 1500
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
        content: "Responda APENAS JSON válido."
      },

      {
        role: "user",
        content: `

Atualize o perfil SST da empresa.

CONHECIMENTO ATUAL:
${existingText || "nenhum"}

NOVA ANÁLISE:
${analysis}

Retorne JSON:

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

    const clean = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim()

    if (!clean.startsWith("{")) {
      throw new Error("Resposta não é JSON")
    }

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


// ─────────────────────────────────────────────
// 7. RAG
// ─────────────────────────────────────────────
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
    .map(c => {

      let emb: number[] = []

      try {
        emb =
          typeof c.embedding === "string"
            ? JSON.parse(c.embedding)
            : c.embedding ?? []
      } catch {
        emb = []
      }

      return {
        content: c.content,
        title: c.document.title,
        type: c.document.type,
        score: cosineSimilarity(qEmbedding, emb)
      }
    })
    .filter(c => c.score > 0.18)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  return scored.map(c => `
DOCUMENTO: ${c.title}
TIPO: ${c.type}

${c.content}
`)
}


// ─────────────────────────────────────────────
// 8. CHAT
// ─────────────────────────────────────────────
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

Você é um Engenheiro de Segurança do Trabalho especialista em documentos SST.

Responda utilizando APENAS as informações dos documentos fornecidos.

REGRAS IMPORTANTES:

- Nunca invente informações
- Não faça suposições
- Se a informação não existir, diga claramente que não foi encontrada
- Cite sempre a fonte do documento

FORMATO DA RESPOSTA:

Riscos presentes no setor:

1. Tipo de risco: descrição
2. Tipo de risco: descrição

Possíveis efeitos à saúde:
(lista breve)

Medidas de controle:
- EPC
- EPI
- administrativas

Fonte: documento analisado

PERFIL DA EMPRESA:

${profile || "Nenhum documento analisado"}

DOCUMENTOS RELEVANTES:

${relevantChunks.join("\n\n---\n\n") || "Nenhum trecho relevante encontrado"}

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