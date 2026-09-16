export function formatBytes(bytes: number, decimals: number = 2) {
  if (!+bytes) return "0 Bytes"

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"]

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export function formatTransferSpeed(value: number, decimals: number = 2): string {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0
  if (safeValue >= 1024) return `${(safeValue / 1024).toFixed(decimals)}G/s`
  if (safeValue >= 1) return `${safeValue.toFixed(decimals)}M/s`
  return `${(safeValue * 1024).toFixed(decimals)}K/s`
}
