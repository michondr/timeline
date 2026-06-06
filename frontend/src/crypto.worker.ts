/// <reference lib="webworker" />

const enc = new TextEncoder()

function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0))
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

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

self.onmessage = async (e: MessageEvent<{ passphrase: string; kdfSalt: string }>) => {
  try {
    const { passphrase, kdfSalt } = e.data
    const saltBytes = fromB64(kdfSalt)
    const encBits  = await pbkdf2Bits(passphrase, saltBytes, 'enc')
    const authBits = await pbkdf2Bits(passphrase, saltBytes, 'auth')
    const encBitsArr = new Uint8Array(encBits)
    ;(self as DedicatedWorkerGlobalScope).postMessage({ encBitsArr, authKeyHex: toHex(authBits) }, [encBitsArr.buffer])
  } catch (err) {
    self.postMessage({ error: String(err) })
  }
}
