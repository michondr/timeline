import { useState } from 'react'
import type { DerivedKeys } from '../crypto'
import { createVerificationBlob, deriveKeys, fromB64url, generateKdfSalt, toB64url, verifyBlob } from '../crypto'
import {
  ApiError,
  getMe,
  loginFinish,
  passkeyLoginChallenge,
  passkeyLoginVerify,
  passkeyRegisterChallenge,
  passkeyRegisterFinish,
} from '../api'

export type DateFormat = 'DMY-dot'

interface Props {
  mode: 'auth' | 'unlock'
  onAuth: (keys: DerivedKeys, apiToken: string, birthdate: string, dateFormat: DateFormat) => void
}

// ── Logo ──────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text)' }} />
      <div style={{ width: 20, height: 1.5, background: 'var(--muted)' }} />
      <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.4px', padding: '0 5px' }}>timeline</span>
      <div style={{ width: 20, height: 1.5, background: 'var(--muted)' }} />
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text)' }} />
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ width: 22, height: 22, flexShrink: 0 }}>
      <circle cx="8" cy="15" r="4"/>
      <path d="M12 15h9M17 15v3M15 15v2"/>
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round"
      style={{ width: 22, height: 22, flexShrink: 0, animation: 'spin 0.7s linear infinite' }}>
      <path d="M12 3a9 9 0 1 0 9 9"/>
    </svg>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const fi: React.CSSProperties = {
  width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
}

const fl: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, letterSpacing: '0.5px',
  textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6,
}

// ── Passphrase strength ───────────────────────────────────────────────────────
function passphraseStrength(val: string) {
  if (!val) return { pct: '0%', color: 'transparent', label: 'Enter a memorable phrase or sentence' }
  let score = 0
  if (val.length >= 10) score++
  if (val.length >= 20) score++
  if (val.split(' ').length >= 3) score++
  if (/[0-9]/.test(val) || /[^a-zA-Z0-9 ]/.test(val)) score++
  return [
    { color: '#ff3b30', label: 'Too short',  pct: '15%' },
    { color: '#ff9f0a', label: 'Weak',        pct: '35%' },
    { color: '#ffd60a', label: 'Fair',        pct: '60%' },
    { color: '#30d158', label: 'Good',        pct: '80%' },
    { color: '#34c759', label: 'Strong ✓',    pct: '100%' },
  ][Math.min(score, 4)]
}

// ── Error box ─────────────────────────────────────────────────────────────────
function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{
      width: '100%', background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)',
      borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#ff6b6b',
      marginBottom: 20, lineHeight: 1.5,
    }}>
      {msg}
    </div>
  )
}

// ── AuthFlow ──────────────────────────────────────────────────────────────────
type Step = 'passkey' | 'passphrase' | 'register'

export function AuthFlow({ mode, onAuth }: Props) {
  const [step, setStep]           = useState<Step>(mode === 'unlock' ? 'passphrase' : 'passkey')
  const [checking, setChecking]   = useState(false)

  // passphrase step
  const [pass, setPass]             = useState('')
  const [passWorking, setPassWork]  = useState(false)
  const [passError, setPassError]   = useState<string | null>(null)

  // stored from passkey verify step
  const [userHandle, setUserHandle]               = useState('')
  const [loginKdfSalt, setLoginKdfSalt]           = useState('')
  const [loginVerifBlob, setLoginVerifBlob]       = useState('')

  // register step
  const [birth, setBirth]             = useState('')
  const [regPass, setRegPass]         = useState('')
  const [regConfirm, setRegConfirm]   = useState('')
  const [showRegPass, setShowReg]     = useState(false)
  const [regWorking, setRegWork]      = useState(false)
  const [regError, setRegError]       = useState<string | null>(null)

  const strength = passphraseStrength(regPass)
  const matchOk  = regConfirm.length > 0 && regPass === regConfirm

  // ── Passkey click ─────────────────────────────────────────────────────
  async function handlePasskey() {
    setChecking(true)
    try {
      // 1. Get challenge from server
      const opts = await passkeyLoginChallenge()

      // 2. Ask authenticator (1Password, Touch ID, etc.)
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge:        fromB64url(opts.challenge),
          rpId:             opts.rpId,
          timeout:          opts.timeout,
          userVerification: 'preferred',
        },
      }) as PublicKeyCredential | null

      if (!credential) throw new Error('No credential returned')

      const assertionResp = credential.response as AuthenticatorAssertionResponse
      const uh = assertionResp.userHandle
        ? toB64url(new Uint8Array(assertionResp.userHandle))
        : null

      if (!uh) throw new Error('Passkey has no userHandle stored')

      // 3. Ask server if user exists
      const result = await passkeyLoginVerify(uh)
      setUserHandle(uh)

      if (result.found) {
        setLoginKdfSalt(result.kdfSalt)
        setLoginVerifBlob(result.verificationBlob)
        setStep('passphrase')
      } else {
        setStep('register')
      }
    } catch {
      // No passkeys for this site, or user cancelled → show registration
      setStep('register')
    } finally {
      setChecking(false)
    }
  }

  // ── Passphrase submit ─────────────────────────────────────────────────
  async function handlePassphrase(e: React.FormEvent) {
    e.preventDefault()
    if (!pass) { setPassError('Please enter your passphrase'); return }
    setPassError(null)
    setPassWork(true)
    try {
      let kdfSalt: string, verifBlob: string, token: string, bdate: string

      if (mode === 'unlock') {
        // Token already in localStorage; fetch salts for the authenticated user
        const me = await getMe()
        kdfSalt   = me.kdfSalt
        verifBlob = me.verificationBlob
        bdate     = me.birthdate
        token     = localStorage.getItem('timeline_token')!
      } else {
        kdfSalt   = loginKdfSalt
        verifBlob = loginVerifBlob
        bdate     = ''   // will be set after loginFinish
        token     = ''
      }

      const keys = await deriveKeys(pass, kdfSalt)
      if (!await verifyBlob(keys.encKey, verifBlob)) {
        setPassError('Wrong passphrase')
        return
      }

      if (mode === 'unlock') {
        onAuth(keys, token, bdate, 'DMY-dot')
      } else {
        const r = await loginFinish(userHandle, keys.authKeyHex)
        localStorage.setItem('timeline_token', r.apiToken)
        localStorage.setItem('timeline_birthdate', r.birthdate)
        onAuth(keys, r.apiToken, r.birthdate, 'DMY-dot')
      }
    } catch (err) {
      setPassError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setPassWork(false)
    }
  }

  // ── Register submit ───────────────────────────────────────────────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!birth) { setRegError('Enter your date of birth'); return }
    if (regPass.length < 10) { setRegError('Passphrase must be at least 10 characters'); return }
    if (regPass !== regConfirm) { setRegError('Passphrases do not match'); return }
    setRegError(null)
    setRegWork(true)
    try {
      // 1. Get passkey creation challenge (includes server-generated userId)
      const opts = await passkeyRegisterChallenge()

      // 2. Create passkey in browser
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: fromB64url(opts.challenge),
          rp:        { id: opts.rpId, name: opts.rpName },
          user: {
            id:          fromB64url(opts.userId),
            name:        'timeline',
            displayName: 'Timeline',
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7  },   // ES256
            { type: 'public-key', alg: -257 },   // RS256
          ],
          timeout:              opts.timeout,
          authenticatorSelection: {
            residentKey:      'required',
            userVerification: 'preferred',
          },
        },
      }) as PublicKeyCredential | null

      if (!credential) throw new Error('Passkey creation cancelled')

      // 3. Derive keys from passphrase
      const kdfSalt = generateKdfSalt()
      const keys    = await deriveKeys(regPass, kdfSalt)
      const blob    = await createVerificationBlob(keys.encKey)

      // 4. Register on server using the userId from challenge as userHandle
      const { apiToken, birthdate: bdate } = await passkeyRegisterFinish({
        userHandle:        opts.userId,
        birthdate:         birth,
        kdfSalt,
        verificationBlob:  blob,
        authKeyHex:        keys.authKeyHex,
      })

      localStorage.setItem('timeline_token', apiToken)
      localStorage.setItem('timeline_birthdate', bdate)
      onAuth(keys, apiToken, bdate, 'DMY-dot')
    } catch (err) {
      setRegError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setRegWork(false)
    }
  }

  // ── Card shell ────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: 'var(--bg)',
    }}>
      <div style={{
        width: 380, background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '40px 36px 32px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        <Logo />

        {/* ── Step: passkey ── */}
        {step === 'passkey' && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.3px', marginBottom: 8, textAlign: 'center' }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5, marginBottom: 32 }}>
              Sign in with your passkey.<br />
              <span style={{ fontSize: 12 }}>No account yet? You'll be guided through setup.</span>
            </p>

            <button
              onClick={handlePasskey}
              disabled={checking}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                padding: '13px 20px', border: 'none', borderRadius: 10,
                background: checking ? 'var(--s2)' : 'var(--accent)',
                color: checking ? 'var(--muted)' : '#fff',
                fontSize: 15, fontWeight: 500, cursor: checking ? 'default' : 'pointer',
                marginBottom: 20, transition: 'background 0.15s',
              }}
            >
              {checking ? <SpinnerIcon /> : <KeyIcon />}
              {checking ? 'Checking…' : 'Sign in with passkey'}
            </button>

            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: 'var(--s2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--muted)',
              lineHeight: 1.5, width: '100%',
            }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>🔒</span>
              <span>Your passkey is stored in 1Password. You'll be prompted to authenticate with biometrics or PIN.</span>
            </div>
          </>
        )}

        {/* ── Step: passphrase ── */}
        {step === 'passphrase' && (
          <form onSubmit={handlePassphrase} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.3px', marginBottom: 8, textAlign: 'center' }}>
              {mode === 'unlock' ? 'Unlock timeline' : 'Enter your passphrase'}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5, marginBottom: 32 }}>
              {mode === 'unlock'
                ? 'Re-enter your passphrase to decrypt your data.'
                : 'Your passphrase decrypts your timeline data.'}
            </p>

            <div style={{ width: '100%', marginBottom: 16 }}>
              <div style={fl}>Passphrase</div>
              <input
                type="password" value={pass} onChange={e => setPass(e.target.value)}
                style={fi} autoFocus autoComplete="current-password" disabled={passWorking}
              />
            </div>

            {passError && <ErrorBox msg={passError} />}

            <button type="submit" disabled={passWorking} style={{
              width: '100%', padding: '13px 20px', border: 'none', borderRadius: 10,
              background: passWorking ? 'var(--s2)' : 'var(--accent)',
              color: passWorking ? 'var(--muted)' : '#fff',
              fontSize: 15, fontWeight: 500, cursor: passWorking ? 'not-allowed' : 'pointer',
            }}>
              {passWorking ? 'Deriving keys…' : mode === 'unlock' ? 'Unlock' : 'Sign in'}
            </button>
          </form>
        )}

        {/* ── Step: register ── */}
        {step === 'register' && (
          <form onSubmit={handleRegister} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.3px', marginBottom: 8, textAlign: 'center' }}>
              Create your timeline
            </h1>
            <p style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5, marginBottom: 28 }}>
              No passkey found. Let's set up your account.
            </p>

            <div style={{ width: '100%', marginBottom: 16 }}>
              <div style={fl}>Date of birth</div>
              <input
                type="date" value={birth} onChange={e => setBirth(e.target.value)}
                style={fi} autoFocus
              />
            </div>

            <div style={{ width: '100%', marginBottom: 8 }}>
              <div style={fl}>Passphrase</div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showRegPass ? 'text' : 'password'}
                  value={regPass} onChange={e => setRegPass(e.target.value)}
                  style={{ ...fi, paddingRight: 38 }}
                  placeholder="e.g. my first cat was named Luna"
                  autoComplete="new-password" spellCheck={false}
                />
                <button type="button" onClick={() => setShowReg(v => !v)} tabIndex={-1}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, padding: 2 }}>
                  {showRegPass ? '🙈' : '👁'}
                </button>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', marginTop: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, width: strength.pct, background: strength.color, transition: 'width 0.3s, background 0.3s' }} />
              </div>
              <div style={{ fontSize: 11, marginTop: 4, color: regPass ? strength.color : 'var(--muted)' }}>{strength.label}</div>
            </div>

            <div style={{ width: '100%', marginBottom: 20 }}>
              <div style={fl}>Confirm passphrase</div>
              <input
                type="password" value={regConfirm} onChange={e => setRegConfirm(e.target.value)}
                style={fi} autoComplete="new-password" spellCheck={false}
              />
              {regConfirm && (
                <div style={{ fontSize: 11, marginTop: 4, color: matchOk ? '#34c759' : '#ff6b6b' }}>
                  {matchOk ? '✓ Passphrases match' : 'Passphrases do not match'}
                </div>
              )}
            </div>

            {regError && <ErrorBox msg={regError} />}

            <button type="submit" disabled={regWorking} style={{
              width: '100%', padding: '13px 20px', border: 'none', borderRadius: 10,
              background: regWorking ? 'var(--s2)' : 'var(--accent)',
              color: regWorking ? 'var(--muted)' : '#fff',
              fontSize: 15, fontWeight: 500, cursor: regWorking ? 'not-allowed' : 'pointer',
            }}>
              {regWorking ? 'Creating…' : 'Create account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
