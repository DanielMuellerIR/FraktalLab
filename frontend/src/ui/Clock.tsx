import { useEffect, useState } from 'react'

export default function Clock() {
  const [t, setT] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="font-mono text-green-400">{t.toLocaleTimeString('en-GB')}</span>
}
