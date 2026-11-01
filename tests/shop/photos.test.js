import { photoPath, fitWithin, publicPhotoUrl } from '../../src/shop/photos.js'

test('fitWithin scales the long side to 800', () => expect(fitWithin(4000, 3000)).toEqual({ width: 800, height: 600 }))
test('fitWithin scales portrait images', () => expect(fitWithin(3000, 4000)).toEqual({ width: 600, height: 800 }))
test('fitWithin leaves small images alone', () => expect(fitWithin(500, 300)).toEqual({ width: 500, height: 300 }))
test('photoPath', () => expect(photoPath('p1', 'u1')).toBe('p1/u1.jpg'))
test('photoPath generates a uuid by default', () => expect(photoPath('p1')).toMatch(/^p1\/[0-9a-f-]{36}\.jpg$/))
test('publicPhotoUrl is null without a path', () => expect(publicPhotoUrl({}, null)).toBeNull())
