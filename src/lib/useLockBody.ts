import { useEffect } from 'react'

let lockCount = 0

export function useLockBody(active: boolean) {
  useEffect(() => {
    if (!active) return
    lockCount += 1
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      lockCount = Math.max(0, lockCount - 1)
      if (lockCount === 0) document.body.style.overflow = previous
    }
  }, [active])
}
