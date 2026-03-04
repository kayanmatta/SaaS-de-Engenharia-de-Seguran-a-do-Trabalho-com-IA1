'use client'

import { useState, FormEvent } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import styles from "../login/login.module.css"
import reg from "./register.module.css"

export default function RegisterPage() {
  const { data: session, status } = useSession()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  if (status === "loading") return null

  if (!session || ((session.user as any)?.role !== "ADMIN" && (session.user as any)?.role !== "SUPERADMIN")) {
    router.replace("/dashboard")
    return null
  }

  const user = session.user as any
  const companyName = user?.companyName ?? "—"

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)

    const response = await fetch("/api/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      headers: { "Content-Type": "application/json" },
    })

    setLoading(false)

    if (response.ok) {
      setSuccess("Usuário cadastrado com sucesso!")
      setEmail("")
      setPassword("")
    } else {
      const data = await response.json()
      setError(data?.error || "Erro ao cadastrar. Tente novamente.")
    }
  }

  return (
    <div className={styles.loginRoot}>

      {/* LEFT: Brand Panel */}
      <div className={styles.panelLeft}>
        <div className={styles.panelLeftInner}>
          <div className={styles.logoContainer}>
            <svg viewBox="0 0 340 340" xmlns="http://www.w3.org/2000/svg">
              <path id="logo_path_1" d="M47.67 0h226.59v226.59H47.67z" />
              <rect id="logo_border" x="47.67" y="0" width="226.59" height="226.59" fill="none" />
              <path id="logo_path_text" d="M0 243.47h1.14l37.46 46.92 37.27-46.92h1.27v81.72h-8.3v-53.33c0-3.68.36-9.26.36-9.26a86.14 86.14 0 0 1-5.7 8.43l-24.36 30.88h-1.42l-24.06-30.88a97 97 0 0 1-5.81-8.43s.48 5.58.48 9.26v53.33H.03ZM92.8 300.61c0-14.38 11.39-25.66 26.08-25.66a25.43 25.43 0 0 1 25.85 25.66c0 14.37-11.26 25.53-25.85 25.53S92.8 314.98 92.8 300.61Zm43.51 0c0-10.57-7-18.41-17.43-18.41s-17.66 7.84-17.66 18.41 7.12 18.41 17.66 18.41 17.43-7.84 17.43-18.41ZM159.14 276.02h8.3l-.23 9.62c3.08-7.49 8.53-10.57 14.34-10.57a14.28 14.28 0 0 1 8.59 2.4l-3.2 7.25a11.42 11.42 0 0 0-6.75-1.9c-7 0-12.69 5-12.69 16.51v25.89h-8.36ZM223.9 319.14c7.35 0 12.33-3 15.53-6.54l5.1 5c-4.5 5.11-11 8.55-20.63 8.55-16.12 0-26.55-11.16-26.55-25.53s11-25.66 25.37-25.66c15.76 0 25.24 12.12 24.65 28.39h-41.72c1.06 9.37 7.49 15.79 18.25 15.79Zm15.17-22.1c-.71-8.43-6-15.08-16.35-15.08-9.37 0-15.65 6.05-17 15.08ZM262.14 243.47h8.3v81.76h-8.3ZM289.21 243.47h8.3v81.76h-8.3ZM314.14 255.94a5.93 5.93 0 1 1 11.85 0 5.93 5.93 0 0 1-11.85 0Zm1.78 20.08h8.22v49.17h-8.29Z" />
              <path id="logo_path_2" d="M376.14 249.62H273.91l44.41-59.17-68.08-91.83V244H239V64.65l86.32 116.44 87.29-116.27V244h-11.22V98.46l-69.08 92Zm-79.78-11.22h57.5l-28.57-38.55Z" transform="translate(-164.86 -49.53)" />
            </svg>
          </div>
        </div>
      </div>

      {/* RIGHT: Form Panel */}
      <div className={styles.panelRight}>
        <div className={styles.formWrapper}>
          <div className={styles.formHeader}>
            <div className={styles.formEyebrow}>Painel Administrativo</div>
            <div className={styles.formTitle}>
              Cadastrar<br />usuário
            </div>
            <div className={styles.formSubtitle}>Somente administradores podem criar contas</div>
          </div>

          {error && (
            <div className={styles.errorBox}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span className={styles.errorText}>{error}</span>
            </div>
          )}

          {success && (
            <div className={reg.successBox}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f766e" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-5" />
              </svg>
              <span className={reg.successText}>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className={styles.fieldGroup}>

              {/* Campo empresa — somente leitura, fixo da sessão */}
              <div className={reg.companyField}>
                <label className={styles.fieldLabel}>Empresa</label>
                <div className={reg.companyValue}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>{companyName}</span>
                </div>
              </div>

              <div className={`${styles.fieldWrapper} ${focusedField === 'email' ? styles.focused : ''}`}>
                <label className={styles.fieldLabel}>E-mail do funcionário</label>
                <input
                  type="email"
                  className={styles.fieldInput}
                  placeholder="funcionario@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  required
                />
                <div className={styles.fieldLine} />
              </div>

              <div className={`${styles.fieldWrapper} ${focusedField === 'password' ? styles.focused : ''}`}>
                <label className={styles.fieldLabel}>Senha provisória</label>
                <input
                  type="password"
                  className={styles.fieldInput}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  required
                />
                <div className={styles.fieldLine} />
              </div>

            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              <span>{loading ? "Cadastrando..." : "Cadastrar usuário"}</span>
              {!loading && <div className={styles.submitArrow} />}
            </button>
          </form>

          <div className={styles.formFooter}>
            <span className={styles.footerText}>© 2026 Morelli Engenharia</span>
            <button
              onClick={() => router.push("/dashboard")}
              className={styles.footerLink}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Voltar ao dashboard
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}