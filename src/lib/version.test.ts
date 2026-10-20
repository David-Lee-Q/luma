import { describe, expect, it } from 'vitest'
import { APP_VERSION, CURRENT_RELEASE, RELEASE_NOTES, TECH_FACTS } from './version'

describe('release notes', () => {
  it('exposes a semver app version', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('lists the current version first', () => {
    expect(CURRENT_RELEASE).toBe(RELEASE_NOTES[0])
    expect(CURRENT_RELEASE.version).toBe('1.0.0')
  })

  it('uses unique versions in descending order', () => {
    const versions = RELEASE_NOTES.map((note) => note.version)
    expect(new Set(versions).size).toBe(versions.length)
    const sorted = [...versions].sort((a, b) =>
      b.localeCompare(a, undefined, { numeric: true }),
    )
    expect(versions).toEqual(sorted)
    expect(versions[0]).toBe(APP_VERSION)
  })

  it('ships dated highlights for every release', () => {
    RELEASE_NOTES.forEach((note) => {
      expect(note.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(note.title.length).toBeGreaterThan(1)
      expect(note.highlights.length).toBeGreaterThan(2)
      note.highlights.forEach((item) => expect(item.length).toBeGreaterThan(6))
    })
  })

  it('describes the local-first runtime facts', () => {
    expect(TECH_FACTS.length).toBeGreaterThan(2)
    TECH_FACTS.forEach((fact) => {
      expect(fact.label.length).toBeGreaterThan(1)
      expect(fact.value.length).toBeGreaterThan(1)
    })
  })
})
