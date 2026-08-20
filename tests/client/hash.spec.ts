import { describe, expect, it } from 'vitest'
import { doudizhuSpaPath, doudizhuTabHash, parseDoudizhuHash } from '../../src/client/hash.ts'

describe('doudizhu hash', () => {
  it('stays closed off the plugin tab', () => {
    expect(parseDoudizhuHash('')).toEqual({ open: false, roomId: null, code: '', invite: '', role: 'sit' })
    expect(parseDoudizhuHash('#/')).toEqual({ open: false, roomId: null, code: '', invite: '', role: 'sit' })
  })

  it('opens the tab and reads invite query from the hash', () => {
    expect(parseDoudizhuHash('#/doudizhu')).toMatchObject({ open: true, roomId: null, code: '', role: 'sit' })
    expect(parseDoudizhuHash('#/doudizhu?code=123456&invite=abc&role=watch')).toEqual({
      open: true,
      roomId: null,
      code: '123456',
      invite: 'abc',
      role: 'watch',
    })
  })

  it('reads a room path without treating it as a new page', () => {
    expect(parseDoudizhuHash('#/doudizhu/room/rm_1')).toMatchObject({ open: true, roomId: 'rm_1' })
    expect(doudizhuTabHash({ roomId: 'rm_1' })).toBe('#/doudizhu/room/rm_1')
  })

  it('builds the SPA path so the join gate can bounce into the tab', () => {
    expect(doudizhuSpaPath({ code: '123456', invite: 'tok' })).toBe('/#/doudizhu?code=123456&invite=tok')
    expect(doudizhuTabHash()).toBe('#/doudizhu')
  })
})
