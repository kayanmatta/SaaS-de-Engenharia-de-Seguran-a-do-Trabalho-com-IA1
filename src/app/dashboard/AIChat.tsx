'use client'

import { useState, useEffect, useRef } from "react"
import styles from "./ai-chat.module.css"

type Message = {
  id?: string
  role: "user" | "assistant"
  content: string
  createdAt?: string
}

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchHistory()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/chat")
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      }
    } finally {
      setLoadingHistory(false)
    }
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
        body: JSON.stringify({ message: userMessage.content }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessages(prev => [...prev, { role: "assistant", content: data.answer }])
      } else {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "Desculpe, ocorreu um erro. Tente novamente."
        }])
      }
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Erro de conexão. Verifique sua internet."
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

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
        <button className={styles.clearBtn} onClick={() => setMessages([])}>
          Limpar conversa
        </button>
      </div>

      {/* MESSAGES */}
      <div className={styles.messages}>
        {loadingHistory ? (
          <div className={styles.loadingHistory}>
            <div className={styles.spinner} />
          </div>
        ) : messages.length === 0 ? (
          <div className={styles.welcome}>
            <div className={styles.welcomeIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" width="40" height="40">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className={styles.welcomeTitle}>Olá! Sou seu assistente de SST</h3>
            <p className={styles.welcomeText}>
              Aprendo com os documentos da sua empresa e respondo dúvidas sobre
              insalubridade, periculosidade, NRs e muito mais.
            </p>
            <div className={styles.suggestions}>
              {[
                "Quais setores têm insalubridade?",
                "Quais NRs se aplicam à minha empresa?",
                "Resuma o último PGR enviado",
                "Há riscos de periculosidade identificados?",
              ].map(s => (
                <button key={s} className={styles.suggestion} onClick={() => setInput(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`${styles.message} ${styles[msg.role]}`}>
              {msg.role === "assistant" && (
                <div className={styles.msgAvatar}>M</div>
              )}
              <div className={styles.msgBubble}>
                <div className={styles.msgContent}>
                  {msg.content.split("\n").map((line, j) => (
                    <span key={j}>
                      {line}
                      {j < msg.content.split("\n").length - 1 && <br />}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.msgAvatar}>M</div>
            <div className={styles.msgBubble}>
              <div className={styles.typing}>
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div className={styles.inputArea}>
        <textarea
          className={styles.input}
          placeholder="Pergunte sobre seus documentos, NRs, insalubridade..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button
          className={styles.sendBtn}
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>

    </div>
  )
}