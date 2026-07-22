export interface DroppedFilesResult {
  files: File[]
  /** Fehler der Ordnerwanderung; files enthaelt dann den direkten Fallback. */
  error?: unknown
}

function entryFromItem(item: DataTransferItem): FileSystemEntry | null {
  return item.webkitGetAsEntry?.() ?? null
}

async function walkEntry(entry: FileSystemEntry, out: File[]): Promise<void> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry
    const file = await new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject))
    out.push(file)
    return
  }

  if (!entry.isDirectory) return
  const reader = (entry as FileSystemDirectoryEntry).createReader()
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
    if (batch.length === 0) break
    for (const child of batch) await walkEntry(child, out)
  }
}

/**
 * Sammelt Datei- und Ordner-Drops. Die direkten Dateien werden synchron
 * gesichert, weil DataTransfer nach dem Event ungueltig werden kann.
 */
export async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<DroppedFilesResult> {
  const directFiles = Array.from(dataTransfer.files ?? [])
  const entries = Array.from(dataTransfer.items ?? [])
    .map(entryFromItem)
    .filter((entry): entry is FileSystemEntry => entry !== null)

  if (entries.length === 0) return { files: directFiles }

  try {
    const files: File[] = []
    for (const entry of entries) await walkEntry(entry, files)
    files.sort((a, b) => a.name.localeCompare(b.name))
    return { files }
  } catch (error) {
    return { files: directFiles, error }
  }
}
