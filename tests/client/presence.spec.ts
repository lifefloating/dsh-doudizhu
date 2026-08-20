import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALREADY_IN_ROOM_MESSAGE } from '../../src/client/presence.ts'

describe('presence copy', () => {
  it('tells the extra tab to stay in the original one', () => {
    expect(ALREADY_IN_ROOM_MESSAGE).toMatch(/已经在这个房间/)
    const card = readFileSync(join(process.cwd(), 'src/client/RoomPreviewCard.tsx'), 'utf8')
    expect(card).toContain('alreadyInRoom')
    expect(card).toContain('ALREADY_IN_ROOM_MESSAGE')
    const host = readFileSync(join(process.cwd(), 'src/client/HostApp.tsx'), 'utf8')
    expect(host).toContain('leaveHere')
    expect(host).toContain('pagehide')
    expect(host).toContain('joinedHereRef')
    expect(host).toContain('roomOccupiedHere')
  })
})
