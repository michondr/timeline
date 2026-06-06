const enc = new TextEncoder()
const dec = new TextDecoder()

export function toB64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  bytes.forEach(b => (s += String.fromCharCode(b)))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - s.length % 4) % 4)
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>
}

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  bytes.forEach(b => (s += String.fromCharCode(b)))
  return btoa(s)
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>
}


export interface DerivedKeys {
  encKey: CryptoKey
  authKeyHex: string
}

export function deriveKeys(passphrase: string, kdfSalt: string): Promise<DerivedKeys> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./crypto.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = async (e: MessageEvent<{ encBitsArr: Uint8Array; authKeyHex: string; error?: string }>) => {
      worker.terminate()
      if (e.data.error) { reject(new Error(e.data.error)); return }
      try {
        const encKey = await crypto.subtle.importKey('raw', e.data.encBitsArr as Uint8Array<ArrayBuffer>, 'AES-GCM', false, ['encrypt', 'decrypt'])
        resolve({ encKey, authKeyHex: e.data.authKeyHex })
      } catch (err) {
        reject(err)
      }
    }
    worker.onerror = (err) => { worker.terminate(); reject(err) }
    worker.postMessage({ passphrase, kdfSalt })
  })
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
