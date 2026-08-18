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
    await manager.dispose()
  })
})
