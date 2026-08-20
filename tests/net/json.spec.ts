import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { encodeJson } from '../../src/net/json.ts'
import { RoomManager } from '../../src/room/RoomManager.ts'

describe('wire JSON', () => {
  it('serializes create-room views that contain atom fields', async () => {
    const manager = new RoomManager(null, {}, null)
    const created = await manager.createRoom({ stakeM: 1, maxMultiplier: 8, hostDisplayName: '房主' })
    expect(() => encodeJson(created.view)).not.toThrow()
    expect(() => JSON.stringify(created.view)).not.toThrow()
    const parsed = JSON.parse(encodeJson(created.view)) as { room: { stakeAtoms: string } }
    expect(parsed.room.stakeAtoms).toBe('1000000')
    const invite = new URL(created.sitUrl).searchParams.get('invite') ?? ''
    const preview = await manager.peek({ roomCode: created.roomCode, invite })
    expect(JSON.parse(encodeJson(preview)).alreadyInRoom).toBe(false)
    await manager.dispose()
  })

  it('exposes an unauthenticated plugin-ready probe for the invite gate', () => {
    const source = readFileSync(join(process.cwd(), 'src/net/routes.ts'), 'utf8')
    expect(source).toContain("path === '/api/ready'")
    expect(source).toContain("plugin: 'dsh-poker'")
    expect(source).toContain('turnTimeoutMs: config.turnTimeoutMs')
    const readyAt = source.indexOf("path === '/api/ready'")
    const sessionAt = source.indexOf('sessionByCookie')
    expect(readyAt).toBeGreaterThan(0)
    expect(readyAt).toBeLessThan(sessionAt)
  })

  it('lets a tab close leave without sitting a second identity', () => {
    const source = readFileSync(join(process.cwd(), 'src/net/routes.ts'), 'utf8')
    expect(source).toContain("path === '/api/leave'")
    expect(source).toContain('already-in-room')
    expect(source).toContain('browserId')
  })
})
