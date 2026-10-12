export function isSvgImage(fileOrQueueItem, detectedExtension = '') {
  const file = fileOrQueueItem?.file || fileOrQueueItem
  return Boolean(file?.type?.startsWith('image/svg') || ['svg', 'svgz'].includes(detectedExtension))
}
