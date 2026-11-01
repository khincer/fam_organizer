export const PHOTO_BUCKET = 'shop-products'

export function photoPath(productId, uuid = crypto.randomUUID()) {
  return `${productId}/${uuid}.jpg`
}

export function fitWithin(width, height, max = 800) {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

// Phone photos are 4-8 MB; shrink to a ~800px JPEG before upload.
export async function compressImage(file) {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('compress_failed'))), 'image/jpeg', 0.8)
  })
}

export function publicPhotoUrl(client, path) {
  if (!path || !client?.storage) return null
  return client.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
}
