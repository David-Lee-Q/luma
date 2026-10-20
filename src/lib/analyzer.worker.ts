/// <reference lib="webworker" />
import { ANALYSIS_SIZE, analyzePixels } from './analysis'

interface AnalyzeRequest {
  id: string
  blob: Blob
}

type AnalyzeResponse =
  | { id: string; ok: true; result: ReturnType<typeof analyzePixels> & { width: number; height: number } }
  | { id: string; ok: false; error: string }

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = async (event: MessageEvent<AnalyzeRequest>) => {
  const { id, blob } = event.data
  try {
    const bitmap = await createImageBitmap(blob)
    const width = bitmap.width
    const height = bitmap.height

    const statsCanvas = new OffscreenCanvas(ANALYSIS_SIZE, ANALYSIS_SIZE)
    const statsCtx = statsCanvas.getContext('2d', { willReadFrequently: true })
    if (!statsCtx) throw new Error('Canvas 2D unavailable')
    statsCtx.drawImage(bitmap, 0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE)
    const { data } = statsCtx.getImageData(0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE)
    const stats = analyzePixels(data, ANALYSIS_SIZE, ANALYSIS_SIZE)

    bitmap.close()
    const result = { ...stats, width, height }
    scope.postMessage({ id, ok: true, result } satisfies AnalyzeResponse)
  } catch (error) {
    const message = error instanceof Error ? error.message : '图片解析失败'
    scope.postMessage({ id, ok: false, error: message } satisfies AnalyzeResponse)
  }
}

export {}
