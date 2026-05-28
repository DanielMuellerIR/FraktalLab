import { memo,  useState, useEffect, useRef } from 'react'
import Panel from '../ui/Panel'

// ── Ticker-Definitionen ──────────────────────────────────────────────────────
// mix aus echten Symbolen und fiktiven Hacker-Themen-Tickern
interface TickerDef {
  symbol: string
  basePrice: number // Startpreis in USD (oder BTC-ähnliche Größenordnung)
}

const TICKER_DEFS: TickerDef[] = [
  { symbol: 'AAPL',  basePrice: 214.50 },
  { symbol: 'TSLA',  basePrice: 177.80 },
  { symbol: 'NVDA',  basePrice: 875.20 },
  { symbol: 'MSFT',  basePrice: 420.30 },
  { symbol: 'BTC',   basePrice: 68342.00 },
  { symbol: 'ETH',   basePrice: 3571.40 },
  { symbol: 'NSCR',  basePrice: 42.00 },   // fictional: Neural Scrypt
  { symbol: 'ZERO',  basePrice: 0.01 },    // fictional: Zero-Day Coin
  { symbol: 'NTRY',  basePrice: 13.37 },   // fictional: Network Entry Systems
  { symbol: 'WORM',  basePrice: 7.77 },    // fictional: Worm Protocol
  { symbol: 'EXPL',  basePrice: 99.99 },   // fictional: Exploit Corp
  { symbol: 'R00T',  basePrice: 1337.00 }, // fictional: Root Access Inc
  { symbol: 'DDOS',  basePrice: 0.31 },    // fictional: Distributed Systems LLC
  { symbol: 'PHNM',  basePrice: 55.55 },   // fictional: Phantom Industries
]

// ── State-Typ pro Ticker-Zeile ───────────────────────────────────────────────
interface TickerState {
  symbol: string
  price: number
  change: number    // absolut seit letztem Tick
  changePct: number // prozentual seit letztem Tick
}

// ── Hilfsfunktion: kleiner zufälliger Schritt (±0.8 % des Preises) ──────────
function randomWalk(price: number): number {
  // Gaußähnliche Approximation via drei uniformen Zufallswerten
  const u = (Math.random() + Math.random() + Math.random()) / 3 - 0.5
  // Volatilität höher für Crypto/Penny-Coins, niedriger für Blue Chips
  const vol = price > 1000 ? 0.004 : price < 1 ? 0.12 : 0.008
  return price * (1 + u * vol * 2)
}

// ── Ticker-Tape-Formatter ────────────────────────────────────────────────────
// Baut einen einzeiligen String für den Laufband-Marquee
function formatTape(tickers: TickerState[]): string {
  return tickers
    .map(t => {
      const sign = t.change >= 0 ? '+' : ''
      return `${t.symbol} ${t.price.toFixed(2)} (${sign}${t.changePct.toFixed(2)}%)`
    })
    .join('   ·   ')
}

// ── Initiale Ticker-States aus Definitionen erzeugen ────────────────────────
function initTickers(): TickerState[] {
  return TICKER_DEFS.map(def => ({
    symbol: def.symbol,
    price: def.basePrice,
    change: 0,
    changePct: 0,
  }))
}

// ── Hauptkomponente ──────────────────────────────────────────────────────────
function StockTickerPanel() {
  const [tickers, setTickers] = useState<TickerState[]>(initTickers)

  // Marquee-Animation: wie weit ist das Band bereits nach links gescrollt (px)
  const [marqueeOffset, setMarqueeOffset] = useState(0)
  // Breite des Tape-Texts — wird nach jedem Render gemessen
  const tapeRef = useRef<HTMLSpanElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0) // Ref für rAF-Loop (vermeidet Closure-Stale)

  // ── Preis-Update alle 1,5 Sekunden ──────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setTickers(prev =>
        prev.map(t => {
          const newPrice = Math.max(randomWalk(t.price), 0.001) // nie unter 0
          const delta = newPrice - t.price
          const pct = (delta / t.price) * 100
          return { ...t, price: newPrice, change: delta, changePct: pct }
        })
      )
    }, 1500)
    return () => clearInterval(id)
  }, [])

  // ── Marquee rAF-Loop ─────────────────────────────────────────────────────
  useEffect(() => {
    let rafId: number
    let alive = true

    function loop() {
      if (!alive) return

      const tape = tapeRef.current
      const container = containerRef.current
      if (tape && container) {
        const tapeWidth = tape.scrollWidth
        const containerWidth = container.clientWidth

        // Wenn das Band komplett durchgelaufen ist → von vorne starten
        if (offsetRef.current > tapeWidth + containerWidth) {
          offsetRef.current = 0
        } else {
          offsetRef.current += 0.6 // Pixel pro Frame (≈ 36px/s bei 60fps)
        }
        setMarqueeOffset(offsetRef.current)
      }
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => {
      alive = false
      cancelAnimationFrame(rafId)
    }
  }, [])

  const tapeText = formatTape(tickers)

  return (
    <Panel title="MARKET DATA // LIVE FEED">
      {/* ── Ticker-Liste ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1">
        {/* Spalten-Header */}
        <div className="text-xs font-mono text-green-700 grid grid-cols-[5ch_1fr_1fr_1fr] gap-x-2 pb-1 border-b border-green-900">
          <span>SYM</span>
          <span className="text-right">PRICE</span>
          <span className="text-right">CHG</span>
          <span className="text-right">CHG%</span>
        </div>

        {/* Eine Zeile pro Ticker */}
        {tickers.map(t => {
          // Positive Kursbewegung grün, negative rot, neutral grau beim Initialwert
          const colorClass = t.change > 0
            ? 'text-green-400'
            : t.change < 0
              ? 'text-red-500'
              : 'text-green-700'

          const sign = t.change >= 0 ? '+' : ''

          return (
            <div
              key={t.symbol}
              className={`text-xs font-mono grid grid-cols-[5ch_1fr_1fr_1fr] gap-x-2 py-0.5 border-b border-green-950 ${colorClass}`}
            >
              {/* Symbol immer in hellem Grün, unabhängig von Kursrichtung */}
              <span className="text-green-400 font-bold">{t.symbol}</span>
              <span className="text-right tabular-nums">
                {t.price >= 1000
                  ? t.price.toFixed(0)       // BTC: keine Nachkommastellen
                  : t.price < 1
                    ? t.price.toFixed(4)     // Penny-Coins: 4 Stellen
                    : t.price.toFixed(2)}
              </span>
              <span className="text-right tabular-nums">
                {sign}{t.change.toFixed(2)}
              </span>
              <span className="text-right tabular-nums">
                {sign}{t.changePct.toFixed(2)}%
              </span>
            </div>
          )
        })}
      </div>

      {/* ── Laufband-Marquee ─────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="shrink-0 overflow-hidden border-t border-green-900 bg-green-950/20 h-5 flex items-center"
      >
        {/*
          Das Band ist ein <span> dessen translateX per inline-style animiert wird.
          Ein zweites Exemplar des Texts (tapeText + tapeText) sorgt dafür, dass
          beim Überlauf nahtlos der Anschluss erscheint.
        */}
        <span
          ref={tapeRef}
          className="text-xs font-mono text-green-500 whitespace-nowrap inline-block"
          style={{ transform: `translateX(-${marqueeOffset}px)` }}
        >
          {/* Band-Text zwei Mal: erstes Exemplar scrollt raus, zweites folgt */}
          {tapeText}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{tapeText}
        </span>
      </div>
    </Panel>
  )
}

export default memo(StockTickerPanel);
