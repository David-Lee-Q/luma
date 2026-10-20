import type { AnalysisResult } from './types'

type Pending = {
  resolve: (result: AnalysisResult) => void
  reject: (error: Error) => void
}

class AnalyzerClient {
  private worker: Worker | null = null
  private pending = new Map<string, Pending>()

  private ensureWorker(): Worker {
    if (this.worker) return this.worker
    const worker = new Worker(new URL('./analyzer.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (
      event: MessageEvent<
        | { id: string; ok: true; result: AnalysisResult }
        | { id: string; ok: false; error: string }
      >,
    ) => {
      const message = event.data
      const entry = this.pending.get(message.id)
      if (!entry) return
      this.pending.delete(message.id)
      if (message.ok) entry.resolve(message.result)
      else entry.reject(new Error(message.error))
    }
    worker.onerror = () => {
      this.pending.forEach((entry) =>
        entry.reject(new Error('图片分析线程异常，请重试')),
      )
      this.pending.clear()
      worker.terminate()
      this.worker = null
    }
    this.worker = worker
    return worker
  }

  analyze(id: string, blob: Blob): Promise<AnalysisResult> {
    const worker = this.ensureWorker()
    return new Promise<AnalysisResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      worker.postMessage({ id, blob })
    })
  }
}

export const analyzer = new AnalyzerClient()
