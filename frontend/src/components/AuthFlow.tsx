import { useState } from 'react'
import type { DerivedKeys } from '../crypto'
import { createVerificationBlob, deriveKeys, verifyBlob } from '../crypto'
import { ApiError, loginFinish, loginInit, registerFinish, registerInit } from '../api'

interface Props {
  mode: 'auth' | 'unlock'
  email?: string
  onAuth: (keys: DerivedKeys, apiToken: string, birthdate: string) => void
}

type Tab = 'login' | 'register'

export function AuthFlow({ mode, email: initialEmail = '', onAuth }: Props) {
  const [tab, setTab]         = useState<Tab>('login')
  const [email, setEmail]     = useState(initialEmail)
  const [birthdate, setBirth] = useState('')
  const [pass, setPass]       = useState('')
  const [confirm, setConfirm] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setWorking(true)
    try {
      if (mode === 'unlock') {
        await doUnlock()
      } else if (tab === 'login') {
        await doLogin()
      } else {
        await doRegister()
      }
    } finally {
      setWorking(false)
    }
  }

  async function doUnlock() {
    const { kdfSalt, verificationBlob } = await loginInit(initialEmail)
    const keys = await deriveKeys(pass, kdfSalt)
    if (!await verifyBlob(keys.encKey, verificationBlob)) {
      setError('Wrong passphrase')
      return
    }
    const token  = localStorage.getItem('timeline_token')!
    const bdate  = localStorage.getItem('timeline_birthdate')!
    onAuth(keys, token, bdate)
  }

  async function doLogin() {
    if (!email || !pass) { setError('Email and passphrase are required'); return }
    const { kdfSalt, verificationBlob } = await loginInit(email)
    const keys = await deriveKeys(pass, kdfSalt)
    if (!await verifyBlob(keys.encKey, verificationBlob)) {
      setError('Wrong passphrase')
      return
    }
    const { apiToken, birthdate: bdate } = await loginFinish(email, keys.authKeyHex)
    localStorage.setItem('timeline_token', apiToken)
    localStorage.setItem('timeline_email', email)
    localStorage.setItem('timeline_birthdate', bdate)
    onAuth(keys, apiToken, bdate)
  }

  async function doRegister() {
    if (!email || !birthdate || !pass) { setError('All fields are required'); return }
    if (pass !== confirm) { setError('Passphrases do not match'); return }
    const { kdfSalt } = await registerInit(email)
    const keys = await deriveKeys(pass, kdfSalt)
    const blob = await createVerificationBlob(keys.encKey)
    const { apiToken, birthdate: bdate } = await registerFinish({
      email, birthdate, kdfSalt,
      verificationBlob: blob,
      authKeyHex: keys.authKeyHex,
    })
    localStorage.setItem('timeline_token', apiToken)
    localStorage.setItem('timeline_email', email)
    localStorage.setItem('timeline_birthdate', bdate)
    onAuth(keys, apiToken, bdate)
  }

  const inp: React.CSSProperties = {
    width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
    borderRadius: 6, color: 'var(--text)', padding: '0.5rem 0.75rem',
    fontSize: '0.9rem', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 4,
    fontSize: '0.8rem', color: 'var(--muted)',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg)' }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '2rem', width: '100%', maxWidth: 400,
      }}>
        <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.2rem', color: 'var(--text)' }}>
          {mode === 'unlock' ? 'Unlock timeline' : 'Timeline'}
        </h2>

        {mode === 'auth' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
            {(['login', 'register'] as Tab[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setError(null) }}
                style={{
                  background: tab === t ? 'var(--s3)' : 'transparent',
                  border: '1px solid var(--border)', borderRadius: 6,
                  color: tab === t ? 'var(--text)' : 'var(--muted)',
                  padding: '0.35rem 0.75rem', fontSize: '0.85rem',
                  cursor: 'pointer', fontWeight: tab === t ? 600 : 400,
                }}
              >
                {t === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {mode === 'unlock' ? (
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              Signed in as <span style={{ color: 'var(--text)' }}>{initialEmail}</span>
            </div>
          ) : (
            <label style={lbl}>
              Email
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                style={inp} autoFocus autoComplete="email" disabled={working}
              />
            </label>
          )}

          {mode === 'auth' && tab === 'register' && (
            <label style={lbl}>
              Date of birth
              <input
                type="date" value={birthdate} onChange={e => setBirth(e.target.value)}
                style={inp} disabled={working}
              />
            </label>
          )}

          <label style={lbl}>
            Passphrase
            <input
              type="password" value={pass} onChange={e => setPass(e.target.value)}
              style={inp} disabled={working} autoFocus={mode === 'unlock'}
              autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
            />
          </label>

          {mode === 'auth' && tab === 'register' && (
            <label style={lbl}>
              Confirm passphrase
              <input
                type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                style={inp} autoComplete="new-password" disabled={working}
              />
            </label>
          )}

          {error && (
            <div style={{
              color: 'var(--warn)', fontSize: '0.85rem',
              padding: '0.4rem 0.6rem', borderRadius: 6,
              background: 'rgba(255,159,10,0.1)', border: '1px solid rgba(255,159,10,0.2)',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={working}
            style={{
              background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 6, padding: '0.6rem 1.2rem', fontSize: '0.9rem',
              fontWeight: 600, cursor: working ? 'not-allowed' : 'pointer',
              opacity: working ? 0.6 : 1, width: '100%', marginTop: '0.25rem',
            }}
          >
            {working
              ? 'Deriving keys…'
              : mode === 'unlock'
                ? 'Unlock'
                : tab === 'login' ? 'Sign in' : 'Create account'
            }
          </button>
        </form>
      </div>
    </div>
  )
}
