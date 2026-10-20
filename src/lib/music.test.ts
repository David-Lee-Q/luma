import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CUSTOM_TRACK_ID,
  MUSIC_TRACKS,
  loadBgmPrefs,
  saveBgmPrefs,
} from './music'

function stubLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
  }
  vi.stubGlobal('localStorage', localStorage)
  return store
}

describe('background music preferences', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts muted with the first built-in track', () => {
    stubLocalStorage()
    const prefs = loadBgmPrefs()
    expect(prefs.muted).toBe(true)
    expect(prefs.trackId).toBe(MUSIC_TRACKS[0].id)
    expect(prefs.volume).toBeGreaterThan(0)
  })

  it('round-trips saved preferences', () => {
    const store = stubLocalStorage()
    saveBgmPrefs({ trackId: CUSTOM_TRACK_ID, volume: 0.35, muted: false })
    expect(store.get('luma-bgm-v1')).toContain(CUSTOM_TRACK_ID)
    expect(loadBgmPrefs()).toEqual({ trackId: CUSTOM_TRACK_ID, volume: 0.35, muted: false })
  })

  it('falls back to defaults when stored data is broken', () => {
    stubLocalStorage({ 'luma-bgm-v1': '{not json' })
    expect(loadBgmPrefs()).toEqual({
      trackId: MUSIC_TRACKS[0].id,
      volume: 0.6,
      muted: true,
    })
  })

  it('clamps out-of-range volumes and treats missing muted flag as muted', () => {
    stubLocalStorage({ 'luma-bgm-v1': JSON.stringify({ trackId: 'tide', volume: 4 }) })
    const prefs = loadBgmPrefs()
    expect(prefs.volume).toBe(1)
    expect(prefs.muted).toBe(true)
  })

  it('ships several distinct built-in tracks', () => {
    expect(MUSIC_TRACKS.length).toBeGreaterThanOrEqual(3)
    const ids = MUSIC_TRACKS.map((track) => track.id)
    expect(new Set(ids).size).toBe(ids.length)
    MUSIC_TRACKS.forEach((track) => {
      expect(track.chords.length).toBeGreaterThan(1)
      expect(track.scale.length).toBeGreaterThan(2)
      expect(track.tempo).toBeGreaterThan(40)
    })
  })
})
