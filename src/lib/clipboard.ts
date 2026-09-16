export function escapeMarkdownCell(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>")
}

export function buildMarkdownTable(rows: Array<[string, string]>): string {
  const headers = rows.map(([label]) => escapeMarkdownCell(label))
  const values = rows.map(([, value]) => escapeMarkdownCell(value))

  return [`| ${headers.join(" | ")} |`, `| ${rows.map(() => "---").join(" | ")} |`, `| ${values.join(" | ")} |`].join("\n")
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Fall back for browsers that expose Clipboard API but deny access.
    }
  }

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand("copy")
  textarea.remove()

  if (!copied) {
    throw new Error("Unable to copy text")
  }
}
