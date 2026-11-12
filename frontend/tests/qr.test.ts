import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyCameraError,
  extractPickupTokenFromScan,
  generatePickupQrDataUrl,
  shouldAcceptScannedToken,
  stopMediaStreamTracks,
} from '../src/utils/qr.ts'
import {
  clearStoredPickupTokens,
  readStoredPickupToken,
  writeStoredPickupToken,
} from '../src/utils/storage.ts'

test('generatePickupQrDataUrl produces a valid PNG QR data URL and rejects empty tokens', async () => {
  const token = 'qlp_test_secure_token_1234567890'
  const dataUrl = await generatePickupQrDataUrl(token)
  assert.ok(dataUrl.startsWith('data:image/png;base64,'))

  await assert.rejects(() => generatePickupQrDataUrl('   '))
})

test('pickup token persistence survives tracking refresh and clears on reset', () => {
  const backingStore = new Map<string, string>()
  const originalWindow = globalThis.window

  // Provide minimal window.localStorage shim for Node test execution
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => backingStore.get(key) ?? null,
        setItem: (key: string, value: string) => {
          backingStore.set(key, value)
        },
        removeItem: (key: string) => {
          backingStore.delete(key)
        },
      },
    },
  })

  try {
    writeStoredPickupToken('ord_abc123', 'qlp_secret_abc')
    assert.equal(readStoredPickupToken('ord_abc123'), 'qlp_secret_abc')
    assert.equal(readStoredPickupToken('ord_missing'), null)

    clearStoredPickupTokens()
    assert.equal(readStoredPickupToken('ord_abc123'), null)
  } finally {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  }
})

test('shouldAcceptScannedToken prevents duplicate rapid scans of the same QR token', () => {
  const token = 'qlp_scan_token_abc'
  assert.equal(extractPickupTokenFromScan(`  ${token}  `), token)

  // First scan accepted
  assert.equal(shouldAcceptScannedToken(token, null, 0, 1000), true)

  // Immediate repeat within 3s cooldown rejected
  assert.equal(shouldAcceptScannedToken(token, token, 1000, 2500), false)

  // Different token accepted immediately
  assert.equal(
    shouldAcceptScannedToken('qlp_other_token_xyz', token, 1000, 2500),
    true,
  )

  // Same token accepted again after cooldown elapses
  assert.equal(shouldAcceptScannedToken(token, token, 1000, 4500), true)

  // Blank scan rejected
  assert.equal(shouldAcceptScannedToken('   ', null, 0, 5000), false)
})

test('classifyCameraError maps permission, hardware, and HTTPS errors to actionable messages', () => {
  const denied = Object.assign(new Error('Denied'), { name: 'NotAllowedError' })
  assert.match(classifyCameraError(denied), /permission was denied/i)

  const missing = Object.assign(new Error('No cam'), { name: 'NotFoundError' })
  assert.match(classifyCameraError(missing), /no camera was found/i)

  const busy = Object.assign(new Error('Busy'), { name: 'NotReadableError' })
  assert.match(classifyCameraError(busy), /another application/i)

  const insecure = Object.assign(new Error('HTTPS'), { name: 'SecurityError' })
  assert.match(classifyCameraError(insecure), /https/i)
})

test('stopMediaStreamTracks stops every active video track on scanner close or unmount', () => {
  let stoppedTracks = 0
  const fakeStream = {
    getTracks: () => [
      {
        stop: () => {
          stoppedTracks += 1
        },
      },
      {
        stop: () => {
          stoppedTracks += 1
        },
      },
    ],
  }

  stopMediaStreamTracks(fakeStream)
  assert.equal(stoppedTracks, 2)
  stopMediaStreamTracks(null)
})

