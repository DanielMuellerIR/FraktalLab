export default function Panel({ title, children, className = '', rightLabel }: {
  title: string
  children: React.ReactNode
  className?: string
  rightLabel?: string
}) {
  return (
    <div className={`border border-green-900 bg-black flex flex-col min-h-0 h-full ${className}`}>
      <div className="border-b border-green-900 px-2 py-0.5 flex items-center gap-2 shrink-0">
        <span className="text-green-800 text-xs">■</span>
        <span className="font-mono text-xs text-green-600 uppercase tracking-widest">{title}</span>
        <div className="ml-auto flex items-center gap-2">
          {rightLabel && (
            <span className="font-mono text-[10px] text-green-400 bg-green-950 px-1.5 py-0.2 border border-green-800 select-none">
              {rightLabel}
            </span>
          )}
          <span className="text-green-900 text-xs animate-pulse">●</span>
        </div>
      </div>
      <div className="flex flex-col overflow-hidden flex-1 min-h-0">{children}</div>
    </div>
  )
}
