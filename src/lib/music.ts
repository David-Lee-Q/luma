import { useCallback, useEffect, useRef, useState } from 'react'
import { loadBgmBlob, saveBgmBlob } from './db'

/** 内置背景音乐：用 WebAudio 实时合成，无需额外音频资源。 */
export interface MusicTrack {
  id: string
  name: string
  hint: string
  /** 和弦进行，单位为 MIDI 音高。 */
  chords: number[][]
  /** 旋律音阶，单位为 MIDI 音高。 */
  scale: number[]
  /** 每分钟节拍数。 */
  tempo: number
  padGain: number
  bellGain: number
  waveGain: number
  brightness: number
}

export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: 'quiet-night',
    name: '静谧夜航',
    hint: '极简铺底，适合夜景与人文',
    chords: [
      [50, 57, 62, 65],
      [48, 55, 60, 63],
      [46, 53, 58, 62],
      [45, 52, 57, 60],
    ],
    scale: [74, 77, 81, 84, 86, 89],
    tempo: 54,
    padGain: 0.5,
    bellGain: 0.16,
    waveGain: 0.05,
    brightness: 1400,
  },
  {
    id: 'warm-sun',
    name: '暖阳漫步',
    hint: '明亮琶音，适合日常与美食',
    chords: [
      [48, 55, 60, 64],
      [53, 57, 60, 65],
      [45, 52, 57, 60],
      [43, 50, 55, 59],
    ],
    scale: [72, 76, 79, 81, 84, 88],
    tempo: 76,
    padGain: 0.42,
    bellGain: 0.2,
    waveGain: 0.04,
    brightness: 2100,
  },
  {
    id: 'tide',
    name: '潮汐回响',
    hint: '柔和海浪与空灵音色，适合风景',
    chords: [
      [45, 52, 57, 62],
      [48, 55, 60, 65],
      [43, 50, 55, 59],
      [41, 48, 53, 58],
    ],
    scale: [69, 72, 76, 81, 84],
    tempo: 62,
    padGain: 0.48,
    bellGain: 0.14,
    waveGain: 0.16,
    brightness: 1200,
  },
  {
    id: 'film',
    name: '胶片时光',
    hint: '轻快钟琴，适合人物与合影',
    chords: [
      [53, 60, 65, 69],
      [55, 62, 67, 71],
      [57, 64, 69, 72],
      [52, 59, 64, 68],
    ],
    scale: [77, 79, 81, 84, 86, 88, 89],
    tempo: 84,
    padGain: 0.38,
    bellGain: 0.22,
    waveGain: 0.06,
    brightness: 2400,
  },
]

export const CUSTOM_TRACK_ID = 'custom'

export interface BgmPrefs {
  trackId: string
  volume: number
  muted: boolean
}

const STORAGE_KEY = 'luma-bgm-v1'
const DEFAULT_PREFS: BgmPrefs = { trackId: MUSIC_TRACKS[0].id, volume: 0.6, muted: true }

export function loadBgmPrefs(): BgmPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw) as Partial<BgmPrefs>
    const trackId = typeof parsed.trackId === 'string' ? parsed.trackId : DEFAULT_PREFS.trackId
    const volume =
      typeof parsed.volume === 'number' && Number.isFinite(parsed.volume)
        ? Math.min(1, Math.max(0, parsed.volume))
        : DEFAULT_PREFS.volume
    return { trackId, volume, muted: parsed.muted !== false }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function saveBgmPrefs(prefs: BgmPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // 隐私模式下写入失败可忽略，音乐仍会在本次会话生效
  }
}

function midiToFreq(note: number): number {
  return 440 * 2 ** ((note - 69) / 12)
}

type AudioContextCtor = typeof AudioContext

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const scope = window as unknown as {
    AudioContext?: AudioContextCtor
    webkitAudioContext?: AudioContextCtor
  }
  return scope.AudioContext ?? scope.webkitAudioContext ?? null
}

/** 生成一段衰减噪声作为简易混响脉冲响应。 */
function createImpulse(context: AudioContext, seconds = 2.4, decay = 2.6): AudioBuffer {
  const length = Math.floor(context.sampleRate * seconds)
  const impulse = context.createBuffer(2, length, context.sampleRate)
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel)
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay
    }
  }
  return impulse
}

class MusicEngine {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private timer: number | null = null
  private track: MusicTrack = MUSIC_TRACKS[0]
  private step = 0
  private nextTime = 0
  private running = false

  private ensure(): AudioContext | null {
    if (this.context) return this.context
    const Ctor = audioContextCtor()
    if (!Ctor) return null
    const context = new Ctor()
    const master = context.createGain()
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.ratio.value = 3
    const convolver = context.createConvolver()
    convolver.buffer = createImpulse(context)
    const wet = context.createGain()
    wet.gain.value = 0.32
    master.gain.value = 0
    master.connect(compressor)
    compressor.connect(context.destination)
    compressor.connect(convolver)
    convolver.connect(wet)
    wet.connect(context.destination)
    this.context = context
    this.master = master
    return context
  }

  setTrack(track: MusicTrack): void {
    this.track = track
    this.step = 0
    if (this.running && this.context) this.nextTime = this.context.currentTime + 0.08
  }

  setVolume(value: number, muted: boolean): void {
    const context = this.context
    const master = this.master
    if (!context || !master) return
    const target = muted ? 0 : value
    master.gain.cancelScheduledValues(context.currentTime)
    master.gain.setTargetAtTime(target, context.currentTime, 0.25)
  }

  start(): void {
    const context = this.ensure()
    if (!context || !this.master) return
    void context.resume()
    if (this.running) return
    this.running = true
    this.step = 0
    this.nextTime = context.currentTime + 0.08
    this.timer = window.setInterval(() => this.schedule(), 160)
    this.schedule()
  }

  stop(): void {
    this.running = false
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    const context = this.context
    if (context) {
      this.master?.gain.cancelScheduledValues(context.currentTime)
      this.master?.gain.setTargetAtTime(0, context.currentTime, 0.15)
    }
  }

  dispose(): void {
    this.stop()
    void this.context?.close().catch(() => undefined)
    this.context = null
    this.master = null
  }

  private schedule(): void {
    const context = this.context
    if (!context || !this.running) return
    const stepDuration = 60 / this.track.tempo / 2
    while (this.nextTime < context.currentTime + 1.2) {
      this.playStep(this.step, this.nextTime, stepDuration)
      this.step += 1
      this.nextTime += stepDuration
    }
  }

  private playStep(step: number, time: number, stepDuration: number): void {
    const context = this.context
    const master = this.master
    if (!context || !master) return
    const track = this.track
    const bar = Math.floor(step / 8) % track.chords.length
    const chord = track.chords[bar]
    const inBar = step % 8

    if (inBar === 0 || inBar === 4) {
      const span = stepDuration * 4
      chord.forEach((note, voiceIndex) => {
        this.pad(time, midiToFreq(note), span, track.padGain * (voiceIndex === 0 ? 1 : 0.72))
      })
    }

    if (inBar % 2 === 1) {
      const note = track.scale[(step * 3 + bar) % track.scale.length]
      this.bell(time, midiToFreq(note), track.bellGain * (inBar === 3 ? 1.4 : 1))
    }

    if (track.waveGain > 0 && inBar === 0) {
      this.wave(time, stepDuration * 8, track.waveGain)
    }
  }

  private pad(time: number, frequency: number, duration: number, gain: number): void {
    const context = this.context
    const master = this.master
    if (!context || !master) return
    const osc = context.createOscillator()
    const sub = context.createOscillator()
    const filter = context.createBiquadFilter()
    const amp = context.createGain()
    osc.type = 'triangle'
    sub.type = 'sine'
    osc.frequency.value = frequency
    sub.frequency.value = frequency / 2
    filter.type = 'lowpass'
    filter.frequency.value = this.track.brightness
    filter.Q.value = 0.6
    const attack = Math.min(duration * 0.4, 1.6)
    amp.gain.setValueAtTime(0, time)
    amp.gain.linearRampToValueAtTime(gain, time + attack)
    amp.gain.linearRampToValueAtTime(0, time + duration)
    osc.connect(filter)
    sub.connect(filter)
    filter.connect(amp)
    amp.connect(master)
    osc.start(time)
    sub.start(time)
    osc.stop(time + duration + 0.05)
    sub.stop(time + duration + 0.05)
  }

  private bell(time: number, frequency: number, gain: number): void {
    const context = this.context
    const master = this.master
    if (!context || !master) return
    const osc = context.createOscillator()
    const amp = context.createGain()
    osc.type = 'sine'
    osc.frequency.value = frequency
    amp.gain.setValueAtTime(0, time)
    amp.gain.linearRampToValueAtTime(gain, time + 0.02)
    amp.gain.exponentialRampToValueAtTime(0.0008, time + 1.6)
    osc.connect(amp)
    amp.connect(master)
    osc.start(time)
    osc.stop(time + 1.7)
  }

  private wave(time: number, duration: number, gain: number): void {
    const context = this.context
    const master = this.master
    if (!context || !master) return
    const length = Math.floor(context.sampleRate * duration)
    const buffer = context.createBuffer(1, length, context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i += 1) {
      const progress = i / length
      data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * progress) ** 2
    }
    const source = context.createBufferSource()
    source.buffer = buffer
    const filter = context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(600, time)
    filter.frequency.linearRampToValueAtTime(1500, time + duration)
    filter.Q.value = 0.7
    const amp = context.createGain()
    amp.gain.value = gain
    source.connect(filter)
    filter.connect(amp)
    amp.connect(master)
    source.start(time)
    source.stop(time + duration)
  }
}

export interface BackgroundMusicState {
  prefs: BgmPrefs
  playing: boolean
  customName: string | null
  hasCustom: boolean
}

export interface BackgroundMusicControls extends BackgroundMusicState {
  selectTrack: (trackId: string) => void
  setVolume: (volume: number) => void
  toggleMuted: () => void
  uploadCustom: (file: File) => Promise<void>
  removeCustom: () => Promise<void>
}

/**
 * 幻灯片背景音乐控制器：内置曲目由 WebAudio 实时合成，自定义曲目使用本地音频文件。
 * 默认静音，只有用户主动打开才会出声。
 */
export function useBackgroundMusic(enabled: boolean): BackgroundMusicControls {
  const [prefs, setPrefs] = useState<BgmPrefs>(() => loadBgmPrefs())
  const [customUrl, setCustomUrl] = useState<string | null>(null)
  const [customName, setCustomName] = useState<string | null>(null)
  const engineRef = useRef<MusicEngine | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const getEngine = useCallback(() => {
    if (!engineRef.current) engineRef.current = new MusicEngine()
    return engineRef.current
  }, [])

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio()
      audio.loop = true
      audio.preload = 'auto'
      audioRef.current = audio
    }
    return audioRef.current
  }, [])

  useEffect(() => {
    let active = true
    loadBgmBlob()
      .then((entry) => {
        if (!active || !entry) return
        const url = URL.createObjectURL(entry.blob)
        objectUrlRef.current = url
        setCustomUrl(url)
        setCustomName(entry.name)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    saveBgmPrefs(prefs)
  }, [prefs])

  const isCustom = prefs.trackId === CUSTOM_TRACK_ID && Boolean(customUrl)
  const active = enabled && !prefs.muted
  const playing = active && (isCustom ? Boolean(customUrl) : true)

  useEffect(() => {
    const engine = getEngine()
    if (!enabled) {
      engine.stop()
      audioRef.current?.pause()
      return
    }
    if (isCustom && customUrl) {
      engine.stop()
      const audio = getAudio()
      if (audio.src !== customUrl) audio.src = customUrl
      audio.volume = prefs.muted ? 0 : prefs.volume
      if (prefs.muted) audio.pause()
      else void audio.play().catch(() => undefined)
      return
    }
    audioRef.current?.pause()
    const track = MUSIC_TRACKS.find((item) => item.id === prefs.trackId) ?? MUSIC_TRACKS[0]
    engine.setTrack(track)
    if (prefs.muted) {
      engine.stop()
    } else {
      engine.start()
      engine.setVolume(prefs.volume, false)
    }
  }, [enabled, customUrl, getAudio, getEngine, isCustom, prefs.muted, prefs.trackId, prefs.volume])

  useEffect(() => {
    return () => {
      engineRef.current?.dispose()
      engineRef.current = null
      audioRef.current?.pause()
      audioRef.current = null
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  const selectTrack = useCallback((trackId: string) => {
    setPrefs((current) => ({ ...current, trackId, muted: false }))
  }, [])

  const setVolume = useCallback((volume: number) => {
    setPrefs((current) => ({
      ...current,
      volume: Math.min(1, Math.max(0, volume)),
      muted: current.muted && volume > 0 ? false : current.muted,
    }))
  }, [])

  const toggleMuted = useCallback(() => {
    setPrefs((current) => ({ ...current, muted: !current.muted }))
  }, [])

  const uploadCustom = useCallback(
    async (file: File) => {
      const url = URL.createObjectURL(file)
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = url
      setCustomUrl(url)
      setCustomName(file.name)
      setPrefs((current) => ({ ...current, trackId: CUSTOM_TRACK_ID, muted: false }))
      await saveBgmBlob(file, file.name).catch(() => undefined)
    },
    [],
  )

  const removeCustom = useCallback(async () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = null
    setCustomUrl(null)
    setCustomName(null)
    await saveBgmBlob(null).catch(() => undefined)
    setPrefs((current) =>
      current.trackId === CUSTOM_TRACK_ID ? { ...current, trackId: MUSIC_TRACKS[0].id } : current,
    )
  }, [])

  return {
    prefs,
    playing,
    customName,
    hasCustom: Boolean(customUrl),
    selectTrack,
    setVolume,
    toggleMuted,
    uploadCustom,
    removeCustom,
  }
}
