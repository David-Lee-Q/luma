import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDate } from '../lib/format'
import { useLibrary } from '../lib/library'
import { CUSTOM_TRACK_ID, MUSIC_TRACKS, useBackgroundMusic } from '../lib/music'
import { useLockBody } from '../lib/useLockBody'
import type { PhotoMeta } from '../lib/types'
import {
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconMusic,
  IconPause,
  IconPlay,
  IconShuffle,
  IconVolume,
  IconVolumeOff,
} from './Icons'

interface SlideshowProps {
  ids: string[]
  startIndex: number
  title: string
  onClose: () => void
}

const INTERVALS = [3000, 5000, 8000]

export function Slideshow({ ids, startIndex, title, onClose }: SlideshowProps) {
  const { photos, urlFor } = useLibrary()
  const [index, setIndex] = useState(Math.max(0, startIndex))
  const [previous, setPrevious] = useState<number | null>(null)
  const [playing, setPlaying] = useState(true)
  const [interval, setIntervalMs] = useState(5000)
  const [shuffle, setShuffle] = useState(false)
  const [chrome, setChrome] = useState(true)
  const [musicOpen, setMusicOpen] = useState(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const lastIndex = useRef(index)
  const music = useBackgroundMusic(true)
  const toggleMusic = music.toggleMuted

  useLockBody(true)

  const items = useMemo(() => {
    const map = new Map(photos.map((photo) => [photo.id, photo]))
    return ids
      .map((id) => map.get(id))
      .filter((photo): photo is PhotoMeta => Boolean(photo))
  }, [ids, photos])

  const photo = items[Math.min(index, Math.max(0, items.length - 1))]

  useEffect(() => {
    if (!items.length) onClose()
  }, [items.length, onClose])

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(0, items.length - 1)))
  }, [items.length])

  useEffect(() => {
    if (lastIndex.current === index) return
    setPrevious(lastIndex.current)
    lastIndex.current = index
    const timer = window.setTimeout(() => setPrevious(null), 950)
    return () => window.clearTimeout(timer)
  }, [index])

  useEffect(() => {
    if (!playing || items.length < 2) return
    const timer = window.setTimeout(() => {
      setIndex((current) => {
        if (shuffle) {
          if (items.length < 2) return current
          let next = current
          while (next === current) next = Math.floor(Math.random() * items.length)
          return next
        }
        return (current + 1) % items.length
      })
    }, interval)
    return () => window.clearTimeout(timer)
  }, [index, interval, items.length, playing, shuffle])

  useEffect(() => {
    if (!playing) return
    type Sentinel = { release: () => Promise<void> }
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: string) => Promise<Sentinel> }
    }
    let sentinel: Sentinel | null = null
    nav.wakeLock
      ?.request('screen')
      .then((lock) => {
        sentinel = lock
      })
      .catch(() => undefined)
    return () => {
      void sentinel?.release().catch(() => undefined)
    }
  }, [playing])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'm' || event.key === 'M') toggleMusic()
      if (event.key === ' ') {
        event.preventDefault()
        setPlaying((value) => !value)
      }
      if (event.key === 'ArrowRight') {
        setIndex((current) => (current + 1) % items.length)
      }
      if (event.key === 'ArrowLeft') {
        setIndex((current) => (current - 1 + items.length) % items.length)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [items.length, onClose, toggleMusic])

  useEffect(() => {
    const urls = [items[(index + 1) % items.length], items[(index - 1 + items.length) % items.length]]
    urls.forEach((item) => {
      if (!item) return
      const url = urlFor(item.id)
      if (url) {
        const image = new Image()
        image.src = url
      }
    })
  }, [index, items, urlFor])

  const goNext = () => setIndex((current) => (current + 1) % items.length)
  const goPrev = () => setIndex((current) => (current - 1 + items.length) % items.length)

  if (!photo) return null

  const url = urlFor(photo.id)
  const previousPhoto = previous !== null ? items[previous] : undefined
  const previousUrl = previousPhoto ? urlFor(previousPhoto.id) : undefined

  return (
    <div className={`slideshow ${chrome ? 'has-chrome' : ''}`} role="dialog" aria-modal="true" aria-label={`${title}幻灯片`}>
      <div
        className="slideshow-stage"
        onClick={() => setChrome((value) => !value)}
        onTouchStart={(event) => {
          const touch = event.touches[0]
          touchStart.current = { x: touch.clientX, y: touch.clientY }
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current
          if (!start) return
          const touch = event.changedTouches[0]
          const dx = touch.clientX - start.x
          const dy = touch.clientY - start.y
          touchStart.current = null
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) {
            if (dx < 0) goNext()
            else goPrev()
          }
        }}
      >
        {previousUrl && (
          <div className="slide-layer slide-layer--previous" key={`prev-${previousPhoto?.id}`}>
            <img src={previousUrl} alt="" />
          </div>
        )}
        {url && (
          <div
            className={`slide-layer slide-layer--current ${playing ? 'is-playing' : ''}`}
            key={`current-${photo.id}`}
          >
            <img src={url} alt={photo.name} className={`kenburns kenburns--${index % 3}`} />
          </div>
        )}
        <div className="slideshow-vignette" aria-hidden="true" />
      </div>

      <header className={`slideshow-top ${chrome ? '' : 'is-hidden'}`}>
        <button type="button" className="glass-btn" onClick={onClose} aria-label="结束播放">
          <IconClose size={20} />
        </button>
        <div className="slideshow-heading">
          <span className="eyebrow">SLIDESHOW</span>
          <strong>{title}</strong>
        </div>
        <span className="slideshow-count">
          {index + 1} / {items.length}
        </span>
      </header>

      {musicOpen && (
        <section className={`slideshow-music ${chrome ? '' : 'is-hidden'}`} aria-label="背景音乐">
          <header className="music-head">
            <div>
              <span className="eyebrow">BACKGROUND MUSIC</span>
              <strong>背景音乐</strong>
            </div>
            <div className="music-volume">
              <button
                type="button"
                className={`music-mute ${music.prefs.muted ? 'is-muted' : ''}`}
                onClick={toggleMusic}
                aria-label={music.prefs.muted ? '开启音乐' : '静音'}
              >
                {music.prefs.muted ? <IconVolumeOff size={17} /> : <IconVolume size={17} />}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(music.prefs.volume * 100)}
                onChange={(event) => music.setVolume(Number(event.target.value) / 100)}
                aria-label="音量"
              />
              <span>{Math.round(music.prefs.volume * 100)}</span>
            </div>
          </header>

          <div className="music-list">
            {MUSIC_TRACKS.map((track) => {
              const activeTrack = music.prefs.trackId === track.id
              return (
                <button
                  key={track.id}
                  type="button"
                  className={`music-item ${activeTrack ? 'is-active' : ''}`}
                  aria-pressed={activeTrack}
                  onClick={() => music.selectTrack(track.id)}
                >
                  <span className="music-item-icon">
                    <IconMusic size={16} />
                  </span>
                  <span className="music-item-text">
                    <strong>{track.name}</strong>
                    <small>{track.hint}</small>
                  </span>
                  {activeTrack && <span className="music-item-tag">当前</span>}
                </button>
              )
            })}

            <div className={`music-item music-item--custom ${music.prefs.trackId === CUSTOM_TRACK_ID ? 'is-active' : ''}`}>
              <span className="music-item-icon">
                <IconMusic size={16} />
              </span>
              <span className="music-item-text">
                <strong>自定义音乐</strong>
                <small>{music.customName ?? '选择本地音频文件，仅保存在本机'}</small>
              </span>
              <label className="music-upload">
                选择
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) void music.uploadCustom(file)
                  }}
                />
              </label>
              {music.hasCustom && (
                <button
                  type="button"
                  className="music-remove"
                  onClick={() => void music.removeCustom()}
                >
                  移除
                </button>
              )}
            </div>
          </div>

          <p className="music-note">
            <IconVolumeOff size={13} />
            默认静音，按 M 键可快速开关；自定义音频不会上传到云端
          </p>
        </section>
      )}

      <footer className={`slideshow-bottom ${chrome ? '' : 'is-hidden'}`}>
        <div className="slideshow-progress">
          <span
            key={`${index}-${interval}`}
            className={`slideshow-progress-fill ${playing ? 'is-running' : 'is-paused'}`}
            style={{ animationDuration: `${interval}ms` }}
          />
        </div>
        <div className="slideshow-meta">
          <div>
            <strong>{photo.name}</strong>
            <span>{formatDate(photo.takenAt)}</span>
          </div>
          <span className="slideshow-hint">轻点画面隐藏控件 · 左右滑动切换 · M 键控制音乐</span>
        </div>
        <div className="slideshow-controls">
          <button type="button" className="glass-btn" onClick={goPrev} aria-label="上一张">
            <IconChevronLeft size={20} />
          </button>
          <button
            type="button"
            className="slideshow-play"
            onClick={() => setPlaying((value) => !value)}
            aria-label={playing ? '暂停' : '播放'}
          >
            {playing ? <IconPause size={22} /> : <IconPlay size={22} />}
          </button>
          <button type="button" className="glass-btn" onClick={goNext} aria-label="下一张">
            <IconChevronRight size={20} />
          </button>

          <div className="slideshow-spacer" />

          <button
            type="button"
            className={`glass-btn ${musicOpen ? 'is-active' : ''} ${music.playing ? 'is-live' : ''}`}
            onClick={() => setMusicOpen((value) => !value)}
            aria-label="背景音乐设置"
            aria-expanded={musicOpen}
          >
            <IconMusic size={19} />
          </button>

          <div className="interval-pills" role="group" aria-label="播放间隔">
            {INTERVALS.map((value) => (
              <button
                key={value}
                type="button"
                className={interval === value ? 'is-active' : ''}
                onClick={() => setIntervalMs(value)}
              >
                {value / 1000}s
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`glass-btn ${shuffle ? 'is-active' : ''}`}
            onClick={() => setShuffle((value) => !value)}
            aria-label={shuffle ? '关闭随机播放' : '开启随机播放'}
            aria-pressed={shuffle}
          >
            <IconShuffle size={19} />
          </button>
        </div>
      </footer>
    </div>
  )
}
