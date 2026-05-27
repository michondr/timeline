const enc = new TextEncoder()
const dec = new TextDecoder()

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  bytes.forEach(b => (s += String.fromCharCode(b)))
  return btoa(s)
}

function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0))
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Derive two independent 256-bit keys from a passphrase + server-provided salt.
 * The same salt + different suffix → independent enc and auth keys.
 */
async function pbkdf2Bits(passphrase: string, saltBytes: Uint8Array, suffix: string): Promise<ArrayBuffer> {
  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveBits'],
  )
  const salt = new Uint8Array([...saltBytes, ...enc.encode(':' + suffix)])
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 200_000, hash: 'SHA-256' },
    baseKey,
    256,
  )
}

export interface DerivedKeys {
  encKey: CryptoKey
  authKeyHex: string
}

export async function deriveKeys(passphrase: string, kdfSalt: string): Promise<DerivedKeys> {
  const saltBytes = fromB64(kdfSalt)
  const [encBits, authBits] = await Promise.all([
    pbkdf2Bits(passphrase, saltBytes, 'enc'),
    pbkdf2Bits(passphrase, saltBytes, 'auth'),
  ])
  const encKey = await crypto.subtle.importKey('raw', encBits, 'AES-GCM', false, ['encrypt', 'decrypt'])
  return { encKey, authKeyHex: toHex(authBits) }
}

export function generateKdfSalt(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(32)))
}

const VERIFICATION_PLAINTEXT = 'timeline_v1_ok'

export async function createVerificationBlob(encKey: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encKey, enc.encode(VERIFICATION_PLAINTEXT))
  const out = new Uint8Array(12 + ct.byteLength)
  out.set(iv)
  out.set(new Uint8Array(ct), 12)
  return toB64(out)
}

/** Returns false if the passphrase is wrong (AES-GCM auth tag fails). */
export async function verifyBlob(encKey: CryptoKey, blob: string): Promise<boolean> {
  try {
    const buf = fromB64(blob)
    const pt  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, encKey, buf.slice(12))
    return dec.decode(pt) === VERIFICATION_PLAINTEXT
  } catch {
    return false
  }
}

export async function encryptField(encKey: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encKey, enc.encode(plaintext))
  const out = new Uint8Array(12 + ct.byteLength)
  out.set(iv)
  out.set(new Uint8Array(ct), 12)
  return toB64(out)
}

export async function decryptField(encKey: CryptoKey, ciphertext: string): Promise<string> {
  const buf = fromB64(ciphertext)
  const pt  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, encKey, buf.slice(12))
  return dec.decode(pt)
}
