const illegalFilenameCharacters = /[<>:"/\\|?*\u0000-\u001f]/g

export function sanitizeFilename(value) {
  const cleaned = String(value || 'image')
    .normalize('NFC')
    .replace(illegalFilenameCharacters, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 180)
  return cleaned || 'image'
}

export function createFilename(template, values, usedNames = new Set()) {
  const rendered = String(template || '{name}.{format}').replace(/\{(name|index|format|width|height|date|time)\}/g, (_, key) => values[key] ?? '')
  const safe = sanitizeFilename(rendered)
  const dot = safe.lastIndexOf('.')
  const stem = dot > 0 ? safe.slice(0, dot) : safe
  const extension = dot > 0 ? safe.slice(dot) : ''
  let candidate = safe
  let suffix = 2
  while (usedNames.has(candidate.toLocaleLowerCase())) candidate = `${stem} (${suffix++})${extension}`
  usedNames.add(candidate.toLocaleLowerCase())
  return candidate
}
