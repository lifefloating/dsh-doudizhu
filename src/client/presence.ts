export const ALREADY_IN_ROOM_MESSAGE = '你已经在这个房间里了。请回到原来的标签页，或换一个浏览器再进。'

const CHANNEL = 'dsh-poker'
const LOCK_PREFIX = 'dsh-poker:room:'

type PresenceMessage = { type: 'probe' | 'here'; roomCode: string }

function lockName(roomCode: string): string {
  return `${LOCK_PREFIX}${roomCode}`
}

function channelOrNull(): BroadcastChannel | null {
  try {
    if (typeof BroadcastChannel === 'undefined') return null
    return new BroadcastChannel(CHANNEL)
  } catch {
    return null
  }
}

/** True when another tab in this browser already holds the room. */
export async function roomOccupiedHere(roomCode: string): Promise<boolean> {
  if (!roomCode) return false
  if (await lockHeld(roomCode)) return true
  return broadcastOccupied(roomCode)
}

async function lockHeld(roomCode: string): Promise<boolean> {
  const locks = globalThis.navigator?.locks
  if (!locks?.request) return false
  try {
    let available = false
    await locks.request(lockName(roomCode), { ifAvailable: true }, async (lock) => {
      available = lock !== null
    })
    return !available
  } catch {
    return false
  }
}

function broadcastOccupied(roomCode: string): Promise<boolean> {
  const channel = channelOrNull()
  if (!channel) return Promise.resolve(false)
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      channel.close()
      resolve(false)
    }, 80)
    channel.onmessage = (event: MessageEvent<PresenceMessage>) => {
      const data = event.data
      if (data?.type === 'here' && data.roomCode === roomCode) {
        clearTimeout(timer)
        channel.close()
        resolve(true)
      }
    }
    channel.postMessage({ type: 'probe', roomCode } satisfies PresenceMessage)
  })
}

/** Hold the per-browser room lock until the tab leaves or unloads. */
export function claimRoomPresence(roomCode: string): () => void {
  if (!roomCode) return () => {}
  let releaseLock = (): void => {}
  const held = new Promise<void>((resolve) => {
    releaseLock = resolve
  })
  const abort = typeof AbortController === 'undefined' ? null : new AbortController()
  const locks = globalThis.navigator?.locks
  if (locks?.request) {
    void locks.request(
      lockName(roomCode),
      abort ? { signal: abort.signal } : {},
      () => held,
    ).catch(() => { /* aborted or unsupported */ })
  }
  const channel = channelOrNull()
  const onMessage = (event: MessageEvent<PresenceMessage>): void => {
    const data = event.data
    if (data?.type === 'probe' && data.roomCode === roomCode) {
      channel?.postMessage({ type: 'here', roomCode } satisfies PresenceMessage)
    }
  }
  channel?.addEventListener('message', onMessage)
  return () => {
    releaseLock()
    abort?.abort()
    channel?.removeEventListener('message', onMessage)
    channel?.close()
  }
}
