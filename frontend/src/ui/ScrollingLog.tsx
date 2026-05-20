import { useEffect, useRef, useState } from 'react'

export default function ScrollingLog({ lines, interval, className = '' }: {
  lines: string[]
  interval: number
  className?: string
}) {
  // Zufälliger Einstieg in die Zeilen-Liste → jede Panel-Instanz sieht anderen Startpunkt
  const startRef = useRef(Math.floor(Math.random() * lines.length))

  // 10 Zeilen als Initialzustand, ab der zufälligen Startposition
  const [log, setLog] = useState<string[]>(() =>
    Array.from({ length: 10 }, (_, i) => lines[(startRef.current + i) % lines.length])
  )
  const idxRef = useRef(startRef.current + 10)

  useEffect(() => {
    const t = setInterval(() => {
      const next = lines[idxRef.current % lines.length]
      idxRef.current++
      setLog(prev => [...prev.slice(-80), next])
    }, interval)
    return () => clearInterval(t)
  }, [lines, interval])

  return (
    // justify-end: neueste Zeilen unten, älteste werden oben abgeschnitten → Terminal-Scroll
    <div className={`overflow-hidden font-mono text-xs leading-5 h-full flex flex-col justify-end ${className}`}>
      {log.map((line, i) => (
        <div key={i} className={i === log.length - 1 ? 'text-green-300' : 'text-green-700'}>
          {line}
        </div>
      ))}
    </div>
  )
}
