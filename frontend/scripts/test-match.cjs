const { io } = require('socket.io-client')

const SERVER_URL = process.env.SERVER_URL || 'https://livetalk-hlii.onrender.com'
const TIMEOUT = Number(process.env.TIMEOUT || 15000)

function generateDeviceId() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function verifyAge(deviceId, birthDate = '1990-01-01') {
  const url = `${SERVER_URL}/api/verify-age`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, birthDate }),
    })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, ok: res.ok, data }
  } catch (err) {
    return { status: 0, ok: false, error: err.message }
  }
}

function createClient(name, deviceId) {
  const events = []
  const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] })

  const log = (msg, data) => {
    const line = `[${name}] ${msg}`
    if (data !== undefined) {
      console.log(line + ':', data)
    } else {
      console.log(line)
    }
    events.push({ time: Date.now(), msg, data })
  }

  socket.on('connect', () => log('connected', socket.id))
  socket.on('connect_error', (err) => log('connect_error', err.message))
  socket.on('disconnect', (reason) => log('disconnect', reason))
  socket.on('online-count', (count) => log('online-count', count))
  socket.on('matched', (payload) => log('matched', payload))
  socket.on('partner-left', () => log('partner-left'))
  socket.on('join-error', (payload) => log('join-error', payload))
  socket.on('chat-message', (text) => log('chat-message', text))
  socket.on('webrtc-offer', (payload) => log('webrtc-offer', payload))
  socket.on('webrtc-answer', (payload) => log('webrtc-answer', payload))
  socket.on('webrtc-ice-candidate', (payload) => log('webrtc-ice-candidate', payload))

  const wait = () =>
    new Promise((resolve) => {
      const matched = () => {
        socket.off('matched', matched)
        setTimeout(() => {
          socket.disconnect()
          resolve()
        }, 2000)
      }
      socket.once('matched', matched)
      setTimeout(() => {
        socket.off('matched', matched)
        log('timeout: not matched before deadline')
        socket.disconnect()
        resolve()
      }, TIMEOUT)
    })

  return { name, deviceId, socket, events, wait }
}

async function main() {
  const deviceIdA = generateDeviceId()
  const deviceIdB = generateDeviceId()
  console.log('SERVER_URL:', SERVER_URL)
  console.log('deviceIdA:', deviceIdA)
  console.log('deviceIdB:', deviceIdB)

  console.log('\n--- Verifying ages ---')
  const [ageA, ageB] = await Promise.all([
    verifyAge(deviceIdA),
    verifyAge(deviceIdB),
  ])
  console.log('Age A:', ageA)
  console.log('Age B:', ageB)

  if (!ageA.ok || !ageB.ok) {
    console.error('Age verification failed, aborting matching test.')
    process.exit(1)
  }

  console.log('\n--- Connecting and joining queue ---')
  const clientA = createClient('A', deviceIdA)
  const clientB = createClient('B', deviceIdB)

  // Wait for connections (Render can take several seconds to wake a cold socket).
  let waited = 0
  while (waited < TIMEOUT && (!clientA.socket.connected || !clientB.socket.connected)) {
    await new Promise((r) => setTimeout(r, 500))
    waited += 500
  }

  if (!clientA.socket.connected || !clientB.socket.connected) {
    console.error('One or both sockets failed to connect after', waited, 'ms')
    console.log('A connect_error count:', clientA.events.filter((e) => e.msg === 'connect_error').length)
    console.log('B connect_error count:', clientB.events.filter((e) => e.msg === 'connect_error').length)
    process.exit(1)
  }

  console.log('Emitting join-queue for both clients')
  clientA.socket.emit('join-queue', { deviceId: deviceIdA })
  clientB.socket.emit('join-queue', { deviceId: deviceIdB })

  await Promise.all([clientA.wait(), clientB.wait()])

  console.log('\n=== Summary ===')
  console.log('Client A events:')
  clientA.events.forEach((e) => console.log(`  ${new Date(e.time).toISOString()} ${e.msg}`, e.data))
  console.log('Client B events:')
  clientB.events.forEach((e) => console.log(`  ${new Date(e.time).toISOString()} ${e.msg}`, e.data))

  const matchedA = clientA.events.some((e) => e.msg === 'matched')
  const matchedB = clientB.events.some((e) => e.msg === 'matched')
  if (matchedA && matchedB) {
    console.log('\nMATCHING WORKS: both clients received matched.')
  } else {
    console.log('\nMATCHING BROKEN: at least one client did not receive matched.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
