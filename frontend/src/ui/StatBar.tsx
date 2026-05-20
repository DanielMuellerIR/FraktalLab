import { useEffect, useState } from 'react'

export default function StatBar({ label, value }: { label: string; value: number }) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setInterval(
      () => setV(p => Math.max(5, Math.min(99, p + (Math.random() - 0.48) * 8))),
      900,
    )
    return () => clearInterval(t)
  }, [])
  const filled = Math.round(v / 10)
  return (
    <div className="font-mono text-xs mb-1 flex gap-1">
      <span className="text-green-600 w-14 shrink-0">{label}</span>
      <span className="text-green-400">{'█'.repeat(filled)}{'░'.repeat(10 - filled)}</span>
      <span className="text-green-700">{Math.round(v)}%</span>
    </div>
  )
}
