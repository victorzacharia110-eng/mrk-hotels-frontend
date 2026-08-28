/**
 * Triggers a browser download for a Blob response (e.g. a generated PDF).
 * The object URL is revoked a moment after the click so the browser has time
 * to start reading it before the URL is released.
 * @param {Blob} blob - The file content as a Blob.
 * @param {string} filename - The download file name.
 */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  // The link must be in the DOM for programmatic clicks to work in all browsers.
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
