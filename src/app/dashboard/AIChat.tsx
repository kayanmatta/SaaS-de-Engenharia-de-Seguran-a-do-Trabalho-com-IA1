'use client'

import { useState, useEffect, useRef } from "react"
import styles from "./ai-chat.module.css"

type Message = {
  id?: string
  role: "user" | "assistant"
  content: string
  createdAt?: string
}

type Doc = {
  id: string
  title: string
  type: string
}

const TYPE_LABEL: Record<string, string> = {
  PGR: "PGR", PCMSO: "PCMSO", ASO: "ASO", CLCB: "CLCB",
  LAUDO_INSALUBRIDADE: "L. Insalub.", LAUDO_PERICULOSIDADE: "L. Periculosidade",
  RELATORIO_TECNICO: "Rel. Técnico", TLCAT: "TLCAT",
}

export default function AIChat() {
  const [messages, setMessages]             = useState<Message[]>([])
  const [input, setInput]                   = useState("")
  const [loading, setLoading]               = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)

  const [docs, setDocs]               = useState<Doc[]>([])
  const [selectedDoc, setSelectedDoc] = useState<string>("")
  const [showDocMenu, setShowDocMenu] = useState(false)
  const [docSearch, setDocSearch]     = useState("")

  const [tempFile, setTempFile]         = useState<File | null>(null)
  const [tempFileText, setTempFileText] = useState<string>("")
  const [loadingFile, setLoadingFile]   = useState(false)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const fileRef    = useRef<HTMLInputElement>(null)
  const docMenuRef = useRef<HTMLDivElement>(null)
  const searchRef  = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchHistory(); fetchDocs() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (docMenuRef.current && !docMenuRef.current.contains(e.target as Node)) {
        setShowDocMenu(false)
        setDocSearch("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  useEffect(() => {
    if (showDocMenu) setTimeout(() => searchRef.current?.focus(), 50)
  }, [showDocMenu])

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/chat")
      if (res.ok) setMessages(await res.json())
    } finally {
      setLoadingHistory(false)
    }
  }

  const fetchDocs = async () => {
    try {
      const res = await fetch("/api/documents")
      if (res.ok) {
        const data = await res.json()
        setDocs(data.map((d: any) => ({ id: d.id, title: d.title, type: d.type })))
      }
    } catch {}
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setTempFile(file)
    setSelectedDoc("")
    setLoadingFile(true)
    try {
      if (file.type === "application/pdf") {
        const form = new FormData()
        form.append("file", file)
        const res = await fetch("/api/chat/extract", { method: "POST", body: form })
        if (res.ok) setTempFileText((await res.json()).text)
      } else {
        const reader = new FileReader()
        reader.onload = () => setTempFileText(reader.result as string)
        reader.readAsDataURL(file)
      }
    } catch {
      setTempFileText("")
    } finally {
      setLoadingFile(false)
    }
  }

  const removeTempFile = () => {
    setTempFile(null); setTempFileText("")
    if (fileRef.current) fileRef.current.value = ""
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMessage: Message = { role: "user", content: input.trim() }
    setMessages(prev => [...prev, userMessage])
    setInput("")
    setLoading(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          documentId: selectedDoc || undefined,
          tempFileText: tempFileText || undefined,
          tempFileName: tempFile?.name || undefined,
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: "assistant",
        content: res.ok ? data.answer : "Desculpe, ocorreu um erro. Tente novamente.",
      }])
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erro de conexão. Verifique sua internet." }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const selectedDocName = docs.find(d => d.id === selectedDoc)?.title
  const filteredDocs = docs.filter(d =>
    d.title.toLowerCase().includes(docSearch.toLowerCase()) ||
    (TYPE_LABEL[d.type] ?? d.type).toLowerCase().includes(docSearch.toLowerCase())
  )

  return (
    <div className={styles.wrapper}>

      {/* HEADER */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.aiAvatar}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <div className={styles.aiName}>Assistente Morelli</div>
            <div className={styles.aiStatus}>
              <span className={styles.statusDot} />
              Especialista em SST
            </div>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.docSelector} ref={docMenuRef}>
            <button
              className={`${styles.docSelectorBtn} ${selectedDoc ? styles.docSelectorActive : ""}`}
              onClick={() => setShowDocMenu(!showDocMenu)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className={styles.docSelectorText}>
                {selectedDoc ? selectedDocName : "Selecionar documento"}
              </span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"
                style={{ transform: showDocMenu ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDocMenu && (
              <div className={styles.docDropdown}>
                {/* Busca */}
                <div className={styles.docSearch}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Buscar por título ou tipo..."
                    className={styles.docSearchInput}
                    value={docSearch}
                    onChange={e => setDocSearch(e.target.value)}
                    onClick={e => e.stopPropagation()}
                  />
                  {docSearch && (
                    <button className={styles.docSearchClear} onClick={() => setDocSearch("")}>✕</button>
                  )}
                </div>

                <div className={styles.docList}>
                  {/* Opção "todos" */}
                  <button
                    className={`${styles.docOption} ${!selectedDoc ? styles.docOptionActive : ""}`}
                    onClick={() => { setSelectedDoc(""); setDocSearch(""); setShowDocMenu(false) }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13" style={{ flexShrink: 0 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Todos os documentos
                  </button>

                  {filteredDocs.length === 0 ? (
                    <div className={styles.docEmpty}>
                      {docSearch ? `Nenhum resultado para "${docSearch}"` : "Nenhum documento salvo"}
                    </div>
                  ) : (
                    filteredDocs.map(doc => (
                      <button
                        key={doc.id}
                        className={`${styles.docOption} ${selectedDoc === doc.id ? styles.docOptionActive : ""}`}
                        onClick={() => { setSelectedDoc(doc.id); removeTempFile(); setDocSearch(""); setShowDocMenu(false) }}
                      >
                        <span className={styles.docOptionBadge}>{TYPE_LABEL[doc.type] ?? doc.type}</span>
                        <span className={styles.docOptionTitle}>{doc.title}</span>
                      </button>
                    ))
                  )}
                </div>

                {/* Contador */}
                <div className={styles.docCount}>
                  {docSearch
                    ? `${filteredDocs.length} de ${docs.length} documento${docs.length !== 1 ? "s" : ""}`
                    : `${docs.length} documento${docs.length !== 1 ? "s" : ""}`}
                </div>
              </div>
            )}
          </div>

          <button className={styles.clearBtn} onClick={() => setMessages([])}>Limpar</button>
        </div>
      </div>

      {/* ARQUIVO TEMPORÁRIO */}
      {tempFile && (
        <div className={styles.tempFileBar}>
          {loadingFile ? (
            <><div className={styles.miniSpinner} /> Extraindo texto...</>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span>{tempFile.name}</span>
              <span className={styles.tempFileSize}>({(tempFile.size / 1024 / 1024).toFixed(2)} MB)</span>
              <button className={styles.removeTempFile} onClick={removeTempFile}>✕</button>
            </>
          )}
        </div>
      )}

      {/* MESSAGES */}
      <div className={styles.messages}>
        {loadingHistory ? (
          <div className={styles.loadingHistory}><div className={styles.spinner} /></div>
        ) : messages.length === 0 ? (
          <div className={styles.welcome}>
            <div className={styles.welcomeIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" width="40" height="40">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className={styles.welcomeTitle}>Olá! Sou seu assistente de SST</h3>
            <p className={styles.welcomeText}>
              Selecione um documento salvo ou envie um arquivo para conversar sobre ele.
            </p>
            <div className={styles.suggestions}>
              {["Quais setores têm insalubridade?","Quais NRs se aplicam à minha empresa?","Resuma o último PGR enviado","Há riscos de periculosidade identificados?"].map(s => (
                <button key={s} className={styles.suggestion} onClick={() => setInput(s)}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`${styles.message} ${styles[msg.role]}`}>
              {msg.role === "assistant" && <div className={styles.msgAvatar}>M</div>}
              <div className={styles.msgBubble}>
                <div className={styles.msgContent}>
                  {msg.content.split("\n").map((line, j) => (
                    <span key={j}>{line}{j < msg.content.split("\n").length - 1 && <br />}</span>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.msgAvatar}>M</div>
            <div className={styles.msgBubble}><div className={styles.typing}><span /><span /><span /></div></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div className={styles.inputArea}>
        <input ref={fileRef} type="file" accept=".pdf,image/jpeg,image/png" style={{ display: "none" }} onChange={handleFileChange} />
        <button
          className={`${styles.attachBtn} ${tempFile ? styles.attachBtnActive : ""}`}
          onClick={() => fileRef.current?.click()}
          title="Enviar arquivo para análise"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        <textarea
          className={styles.input}
          placeholder={
            selectedDoc ? `Perguntando sobre: ${selectedDocName}...` :
            tempFile    ? `Perguntando sobre: ${tempFile.name}...` :
            "Pergunte sobre seus documentos, NRs, insalubridade..."
          }
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button className={styles.sendBtn} onClick={sendMessage} disabled={loading || !input.trim()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  )
}