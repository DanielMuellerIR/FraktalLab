import { useContext, useEffect } from 'react'
import { PanelChromeContext } from './PanelSlot'

// Langen, ALLCAPS-Titel in einen kurzen, lesbaren Kurztitel wandeln:
// - nur den Teil VOR dem "//" (der Rest ist meist schmückendes Beiwerk)
// - führende Sonderzeichen weg (z.B. "☢ ")
// - ALLCAPS → Title-Case; kurze Kürzel/Zahlen (C64, AI, 2.0, DNA) bleiben groß
// - auf ~24 Zeichen kürzen
function shortenTitle(title: string): string {
  let t = title.split('//')[0].trim()
  t = t.replace(/^[^A-Za-z0-9]+/, '').trim()
  t = t
    .split(/\s+/)
    .map(w => {
      if (/^[A-Z0-9.]+$/.test(w) && w.length <= 3) return w
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    })
    .join(' ')
  if (t.length > 24) t = t.slice(0, 23).trimEnd() + '…'
  return t
}

// Panel ist jetzt RAHMENLOS und ohne eigene Titelleiste — die einheitliche Deko
// (schwebende Titel-Pille + Vor/Zurück-Pfeile) rendert PanelSlot. Das Panel meldet
// seinen (gekürzten) Titel nur per Kontext nach oben und füllt sonst die ganze
// Kachel randlos aus, sodass benachbarte Panels sich direkt berühren.
export default function Panel({ title, children, className = '', rightLabel }: {
  title: string
  children: React.ReactNode
  className?: string
  rightLabel?: string
}) {
  const chrome = useContext(PanelChromeContext)
  useEffect(() => {
    chrome?.setTitle(shortenTitle(title), rightLabel)
  }, [title, rightLabel, chrome])

  return (
    <div className={`bg-black flex flex-col min-h-0 h-full overflow-hidden ${className}`}>
      <div className="flex flex-col overflow-hidden flex-1 min-h-0">{children}</div>
    </div>
  )
}
