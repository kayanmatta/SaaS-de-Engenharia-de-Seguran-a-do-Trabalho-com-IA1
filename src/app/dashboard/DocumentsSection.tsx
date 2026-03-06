'use client'

import { useState, useEffect, useRef } from "react"
import styles from "./documents.module.css"

type Document = {
  id: string
  title: string
  type: string
  status: string
  fileUrl: string | null
  fileName: string | null
  expiresAt: string | null
  createdAt: string
}

const TYPE_OPTIONS = [
  { value: "PGR",                  label: "PGR" },
  { value: "PCMSO",                label: "PCMSO" },
  { value: "LAUDO_INSALUBRIDADE",  label: "Laudo de Insalubridade" },
  { value: "LAUDO_PERICULOSIDADE", label: "Laudo de Periculosidade" },
  { value: "ASO",                  label: "ASO" },
  { value: "CLCB",                 label: "CLCB" },
  { value: "RELATORIO_TECNICO",    label: "Relatório Técnico" },
  { value: "TLCAT",                label: "TLCAT" },
]

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TYPE_OPTIONS.map(t => [t.value, t.label])
)

const STATUS_OPTIONS = [
  { value: "PENDENTE",   label: "Pendente" },
  { value: "EM_ANALISE", label: "Em Análise" },
  { value: "CONCLUIDO",  label: "Concluído" },
  { value: "VENCIDO",    label: "Vencido" },
]

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map(s => [s.value, s.label])
)

export default function DocumentsSection() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Upload modal
  const [showModal, setShowModal] = useState(false)
  const [title, setTitle] = useState("")
  const [type, setType] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Menu 3 pontos
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  // Edit modal
  const [editDoc, setEditDoc] = useState<Document | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editType, setEditType] = useState("")
  const [editStatus, setEditStatus] = useState("")
  const [editExpiresAt, setEditExpiresAt] = useState("")
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState("")

  // Delete confirm
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchDocuments = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/documents")
      if (!res.ok) throw new Error()
      setDocuments(await res.json())
    } catch {
      setError("Não foi possível carregar os documentos.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDocuments() }, [])

  // Fecha menu ao clicar fora
  useEffect(() => {
  const handler = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest(`.${styles.menuWrapper}`)) {
      setOpenMenu(null)
    }
  }
  document.addEventListener("mousedown", handler)
  return () => document.removeEventListener("mousedown", handler)
}, [])

  // ─── UPLOAD ───────────────────────────────────────────────────────────────
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !title || !type) {
      setUploadError("Preencha todos os campos obrigatórios.")
      return
    }
    setUploading(true)
    setUploadError("")

    const formData = new FormData()
    formData.append("file", file)
    formData.append("title", title)
    formData.append("type", type)
    if (expiresAt) formData.append("expiresAt", expiresAt)

    try {
      const res = await fetch("/api/documents", { method: "POST", body: formData })
      const data = await res.json()

      if (!res.ok) { setUploadError(data.error || "Erro ao enviar documento."); return }

      setTitle(""); setType(""); setExpiresAt(""); setFile(null); setShowModal(false)
      fetchDocuments()

      if (data?.id) {
        fetch("/api/documents/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: data.id }),
        }).then(() => fetchDocuments()).catch(console.error)
      }
    } catch {
      setUploadError("Erro de conexão. Tente novamente.")
    } finally {
      setUploading(false)
    }
  }

  // ─── ABRIR EDIÇÃO ─────────────────────────────────────────────────────────
  const openEdit = (doc: Document) => {
    setEditDoc(doc)
    setEditTitle(doc.title)
    setEditType(doc.type)
    setEditStatus(doc.status)
    setEditExpiresAt(doc.expiresAt ? doc.expiresAt.split("T")[0] : "")
    setEditError("")
    setOpenMenu(null)
  }

  // ─── SALVAR EDIÇÃO ────────────────────────────────────────────────────────
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editDoc) return
    setEditLoading(true)
    setEditError("")

    try {
      const res = await fetch(`/api/documents/${editDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          type: editType,
          status: editStatus,
          expiresAt: editExpiresAt || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setEditError(data.error || "Erro ao salvar.")
        return
      }

      setEditDoc(null)
      fetchDocuments()
    } catch {
      setEditError("Erro de conexão.")
    } finally {
      setEditLoading(false)
    }
  }

  // ─── EXCLUIR ──────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteDoc) return
    setDeleteLoading(true)

    try {
      const res = await fetch(`/api/documents/${deleteDoc.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setDeleteDoc(null)
      fetchDocuments()
    } catch {
      setDeleteLoading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h2 className={styles.tableTitle}>Documentos</h2>
          <button className={styles.newBtn} onClick={() => setShowModal(true)}>+ Novo Documento</button>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        {loading ? (
          <div className={styles.emptyState}><div className={styles.spinner} /><p>Carregando...</p></div>
        ) : documents.length === 0 ? (
          <div className={styles.emptyState}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>Nenhum documento cadastrado ainda.</p>
            <button className={styles.emptyBtn} onClick={() => setShowModal(true)}>Enviar primeiro documento</button>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Documento</th>
                <th>Tipo</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th>Arquivo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {documents.map(doc => (
                <tr key={doc.id}>
                  <td className={styles.docTitle}>{doc.title}</td>
                  <td><span className={styles.typeBadge}>{TYPE_LABEL[doc.type] ?? doc.type}</span></td>
                  <td className={styles.docDate}>
                    {doc.expiresAt ? new Date(doc.expiresAt).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles[`status${doc.status}`]}`}>
                      {STATUS_LABEL[doc.status] ?? doc.status}
                    </span>
                  </td>
                  <td>
                    {doc.fileUrl ? (
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className={styles.fileLink}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Ver
                      </a>
                    ) : "—"}
                  </td>
                  <td className={styles.actionsCell}>
                    <div className={styles.menuWrapper}>
                      <button
                        className={styles.menuBtn}
                        onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === doc.id ? null : doc.id) }}
                      >
                        <span /><span /><span />
                      </button>
                      {openMenu === doc.id && (
                        <div className={styles.menuDropdown} onClick={e => e.stopPropagation()}>
                          <button className={styles.menuItem} onClick={() => openEdit(doc)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Editar
                          </button>
                          <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={() => { setDeleteDoc(doc); setOpenMenu(null) }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── MODAL UPLOAD ─────────────────────────────────────────────────── */}
      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Novo Documento</h3>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleUpload} className={styles.form}>
              {uploadError && <div className={styles.formError}>{uploadError}</div>}
              <div className={styles.field}>
                <label className={styles.label}>Título *</label>
                <input type="text" className={styles.input} placeholder="Ex: PGR — Setor de Produção 2026" value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Tipo de Documento *</label>
                <select className={styles.input} value={type} onChange={e => setType(e.target.value)} required>
                  <option value="">Selecione o tipo...</option>
                  {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Data de Vencimento</label>
                <input type="date" className={styles.input} value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Arquivo (PDF) *</label>
                <div
                  className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ""} ${file ? styles.dropzoneDone : ""}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
                  {file ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#00a79d" strokeWidth="1.5" width="24" height="24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className={styles.fileName}>{file.name}</span>
                      <span className={styles.fileSize}>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span>Arraste o arquivo ou clique para selecionar</span>
                      <span className={styles.dropzoneHint}>PDF, DOC, DOCX até 20MB</span>
                    </>
                  )}
                </div>
              </div>
              <button type="submit" className={styles.submitBtn} disabled={uploading}>
                {uploading ? "Enviando..." : "Cadastrar Documento"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL EDIÇÃO ─────────────────────────────────────────────────── */}
      {editDoc && (
        <div className={styles.overlay} onClick={() => setEditDoc(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Editar Documento</h3>
              <button className={styles.closeBtn} onClick={() => setEditDoc(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEdit} className={styles.form}>
              {editError && <div className={styles.formError}>{editError}</div>}
              <div className={styles.field}>
                <label className={styles.label}>Título *</label>
                <input type="text" className={styles.input} value={editTitle} onChange={e => setEditTitle(e.target.value)} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Tipo de Documento *</label>
                <select className={styles.input} value={editType} onChange={e => setEditType(e.target.value)} required>
                  {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Status</label>
                <select className={styles.input} value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Data de Vencimento</label>
                <input type="date" className={styles.input} value={editExpiresAt} onChange={e => setEditExpiresAt(e.target.value)} />
              </div>
              <button type="submit" className={styles.submitBtn} disabled={editLoading}>
                {editLoading ? "Salvando..." : "Salvar Alterações"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL CONFIRMAÇÃO EXCLUSÃO ───────────────────────────────────── */}
      {deleteDoc && (
        <div className={styles.overlay} onClick={() => setDeleteDoc(null)}>
          <div className={styles.modalConfirm} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" width="32" height="32">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className={styles.confirmTitle}>Excluir documento?</h3>
            <p className={styles.confirmText}>
              <strong>{deleteDoc.title}</strong> será removido permanentemente do sistema e do storage.
            </p>
            <div className={styles.confirmActions}>
              <button className={styles.cancelBtn} onClick={() => setDeleteDoc(null)}>Cancelar</button>
              <button className={styles.deleteBtn} onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}