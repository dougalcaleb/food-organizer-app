/*
Renders the app icon set from the theme's own colors, so the icon cannot drift
from `src/styles/primitives.css` without someone noticing. Committed and
re-runnable (`npm run icons`) rather than hand-exported, because a PNG in the
repo with no source is a dead end.

Dependency-free on purpose: a flat mark needs an analytic rasterizer and a PNG
encoder, both of which are short, and neither is worth a new devDependency in
a frontend repo. Shapes are signed distance fields, antialiased from the
distance itself.

The mark is a check: the shopping list check-off is the app's core gesture, and
a check stays legible at 48px where anything fussier turns to mush.
*/
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BG = [0x1a, 0x1a, 0x1a] // --color-gray-1, hsl(0 0% 10%)
const MARK = [0x6d, 0xbc, 0xb0] // --color-teal-4

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

// --- signed distance fields, in normalized -0.5..0.5 space ---------------

const len = (x, y) => Math.sqrt(x * x + y * y)
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

function sdRoundRect(px, py, half, radius) {
	const qx = Math.abs(px) - half + radius
	const qy = Math.abs(py) - half + radius
	return Math.min(Math.max(qx, qy), 0) + len(Math.max(qx, 0), Math.max(qy, 0)) - radius
}

function sdSegment(px, py, ax, ay, bx, by) {
	const pax = px - ax
	const pay = py - ay
	const bax = bx - ax
	const bay = by - ay
	const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1)
	return len(pax - bax * h, pay - bay * h)
}

// --- PNG encoding --------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
	return c >>> 0
})

function crc32(buf) {
	let c = 0xffffffff
	for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
	return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
	const len = Buffer.alloc(4)
	len.writeUInt32BE(data.length)
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
	const crc = Buffer.alloc(4)
	crc.writeUInt32BE(crc32(body))
	return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
	const ihdr = Buffer.alloc(13)
	ihdr.writeUInt32BE(size, 0)
	ihdr.writeUInt32BE(size, 4)
	ihdr[8] = 8 // bit depth
	ihdr[9] = 6 // RGBA
	// Filter byte 0 per scanline: the image is a handful of flat colors, so
	// deflate handles it and a real filter heuristic would earn nothing.
	const raw = Buffer.alloc(size * (size * 4 + 1))
	for (let y = 0; y < size; y++) {
		raw[y * (size * 4 + 1)] = 0
		rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
	}
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw, { level: 9 })),
		chunk('IEND', Buffer.alloc(0)),
	])
}

// --- the icon itself -----------------------------------------------------

/*
`markScale` shrinks the check for the maskable variant: Android may crop to a
circle inscribed in the icon, so content has to sit inside the central ~80%.
`fullBleed` fills the square instead of rounding the corners, for maskable and
for iOS (which applies its own mask and renders alpha as black).
*/
function render(size, { markScale = 1, fullBleed = false } = {}) {
	const rgba = Buffer.alloc(size * size * 4)
	const stroke = 0.058 * markScale
	// Optically centered rather than mathematically: a check's mass sits low.
	const pts = [
		[-0.2 * markScale, 0.02 * markScale],
		[-0.05 * markScale, 0.17 * markScale],
		[0.22 * markScale, -0.16 * markScale],
	]

	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const px = (x + 0.5) / size - 0.5
			const py = (y + 0.5) / size - 0.5

			const dBg = fullBleed ? -1 : sdRoundRect(px, py, 0.5, 0.115)
			const dMark =
				Math.min(
					sdSegment(px, py, pts[0][0], pts[0][1], pts[1][0], pts[1][1]),
					sdSegment(px, py, pts[1][0], pts[1][1], pts[2][0], pts[2][1]),
				) - stroke

			// Distance -> pixel coverage. Half a pixel of falloff either side.
			const bgCov = clamp(0.5 - dBg * size, 0, 1)
			const markCov = Math.min(clamp(0.5 - dMark * size, 0, 1), bgCov)

			const i = (y * size + x) * 4
			for (let c = 0; c < 3; c++) {
				rgba[i + c] = Math.round(BG[c] + (MARK[c] - BG[c]) * markCov)
			}
			rgba[i + 3] = Math.round(bgCov * 255)
		}
	}
	return encodePng(size, rgba)
}

const targets = [
	['icon-192.png', 192, {}],
	['icon-512.png', 512, {}],
	['icon-maskable-512.png', 512, { markScale: 0.72, fullBleed: true }],
	['apple-touch-icon.png', 180, { fullBleed: true }],
	['favicon-32.png', 32, {}],
]

mkdirSync(OUT, { recursive: true })
for (const [name, size, opts] of targets) {
	const png = render(size, opts)
	writeFileSync(join(OUT, name), png)
	console.log(`${name}  ${size}x${size}  ${png.length} bytes`)
}
