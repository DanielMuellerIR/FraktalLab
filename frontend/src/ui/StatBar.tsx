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
    // text-[1em] statt text-xs: die Schrift erbt jetzt die skalierbare Größe vom
    // Eltern-Container (Vitals setzt dort einen cqmin-clamp), statt fix bei 12px
    // zu kleben. So schrumpfen die Balken in kleinen Kacheln mit.
    <div className="font-mono text-[1em] mb-1 flex gap-1">
      <span className="text-green-600 w-[3.5em] shrink-0">{label}</span>
      <span className="text-green-400">{'█'.repeat(filled)}{'░'.repeat(10 - filled)}</span>
      <span className="text-green-700">{Math.round(v)}%</span>
    </div>
  )
}
