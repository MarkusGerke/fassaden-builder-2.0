/**
 * Konvertiert TTF → Three.js typeface.json (facetype.js-kompatibel).
 * Usage: node scripts/ttf-to-typeface.mjs <input.ttf> <output.json>
 *
 * Wichtig: quadratic/cubic-Befehle speichern Endpunkt vor den Kontrollpunkten
 * (`q x y x1 y1`), nicht SVG-Reihenfolge — sonst liest FontLoader die Kurven falsch
 * und die Schrift wirkt geshreddert.
 *
 * Kontur-Reihenfolge: äußere Kontur zuerst, dann Löcher. ShapePath.toShapes()
 * verliert sonst innere Punzen (z. B. zweites Loch bei „&“), wenn Löcher vor
 * der Außenkontur kommen.
 */
import fs from 'node:fs'
import opentype from 'opentype.js'

const [inputPath, outputPath] = process.argv.slice(2)
if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/ttf-to-typeface.mjs <input.ttf> <output.json>')
  process.exit(1)
}

function dropSfntTable(buffer, tag) {
  const buf = Buffer.from(buffer)
  const numTables = buf.readUInt16BE(4)
  for (let i = 0; i < numTables; i += 1) {
    const off = 12 + i * 16
    if (buf.toString('ascii', off, off + 4) === tag) buf.write('XXXX', off, 4, 'ascii')
  }
  return buf
}

function loadFont(path) {
  try {
    return opentype.loadSync(path)
  } catch (first) {
    // Manche Peter-Wiegel-TTFs haben GDEF ClassDef-Format 3 — opentype.js bricht ab.
    let buf = fs.readFileSync(path)
    for (const tag of ['GDEF', 'GPOS', 'GSUB']) buf = dropSfntTable(buf, tag)
    try {
      return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
    } catch (second) {
      console.error(first)
      throw second
    }
  }
}

const font = loadFont(inputPath)
const scale = 1000 / font.unitsPerEm
const ascender = Math.round(font.ascender * scale)
const descender = Math.round(font.descender * scale)

function round(v) {
  return Math.round(v * scale)
}

/**
 * Facetype.js / typeface.js-Reihenfolge: Endpunkt, dann Kontrollpunkte.
 * FontLoader mappt das intern wieder auf Path.quadraticCurveTo(cp, end).
 * Kontur-Winding bleibt wie in der TTF (außen CW, Löcher CCW in TrueType) — kein Reverse.
 */
function commandToTypeface(command) {
  let type = String(command.type || '').toLowerCase()
  if (type === 'c') type = 'b'
  let out = `${type} `
  if (command.x !== undefined && command.y !== undefined) {
    out += `${round(command.x)} ${round(command.y)} `
  }
  if (command.x1 !== undefined && command.y1 !== undefined) {
    out += `${round(command.x1)} ${round(command.y1)} `
  }
  if (command.x2 !== undefined && command.y2 !== undefined) {
    out += `${round(command.x2)} ${round(command.y2)} `
  }
  return out
}

/** Signed area in Font-Einheiten (positiv = CCW). */
function contourArea(commands) {
  let area = 0
  let x0 = 0
  let y0 = 0
  let startX = 0
  let startY = 0
  let hasPoint = false
  for (const cmd of commands) {
    const type = String(cmd.type || '').toUpperCase()
    if (type === 'M') {
      if (hasPoint) {
        area += startX * y0 - x0 * startY
      }
      x0 = cmd.x ?? 0
      y0 = cmd.y ?? 0
      startX = x0
      startY = y0
      hasPoint = true
    } else if (type === 'Z') {
      if (hasPoint) {
        area += startX * y0 - x0 * startY
        x0 = startX
        y0 = startY
      }
    } else if (cmd.x !== undefined && cmd.y !== undefined) {
      const x1 = cmd.x
      const y1 = cmd.y
      area += x0 * y1 - x1 * y0
      x0 = x1
      y0 = y1
    }
  }
  return area / 2
}

function splitContours(commands) {
  const contours = []
  let current = []
  for (const cmd of commands) {
    const type = String(cmd.type || '').toUpperCase()
    if (type === 'M' && current.length > 0) {
      contours.push(current)
      current = [cmd]
    } else {
      current.push(cmd)
      if (type === 'Z' && current.length > 0) {
        contours.push(current)
        current = []
      }
    }
  }
  if (current.length > 0) contours.push(current)
  return contours
}

/**
 * TrueType: gefüllte Außenkontur ist CW (Fläche < 0), Löcher CCW (Fläche > 0).
 * Äußere Kontur zuerst — sonst verliert Three.js ShapePath.toShapes() Punzen.
 */
function orderContoursOuterFirst(contours) {
  if (contours.length <= 1) return contours
  const scored = contours.map((commands, index) => ({
    commands,
    index,
    area: contourArea(commands),
  }))
  const outers = scored.filter((c) => c.area < 0).sort((a, b) => a.area - b.area)
  const holes = scored.filter((c) => c.area >= 0).sort((a, b) => b.area - a.area)
  // Fallback: größte |area| zuerst, wenn Winding unklar.
  if (outers.length === 0) {
    return scored
      .slice()
      .sort((a, b) => Math.abs(b.area) - Math.abs(a.area))
      .map((c) => c.commands)
  }
  return [...outers, ...holes].map((c) => c.commands)
}

const glyphs = {}
for (let i = 0; i < font.glyphs.length; i += 1) {
  const glyph = font.glyphs.get(i)
  if (!glyph?.unicode) continue
  const char = String.fromCharCode(glyph.unicode)
  const contours = orderContoursOuterFirst(splitContours(glyph.path.commands))
  let outline = ''
  for (const contour of contours) {
    for (const cmd of contour) {
      outline += commandToTypeface(cmd)
    }
  }
  glyphs[char] = {
    ha: Math.round((glyph.advanceWidth ?? 0) * scale),
    x_min: Math.round((glyph.xMin ?? 0) * scale),
    x_max: Math.round((glyph.xMax ?? 0) * scale),
    o: outline.trim(),
  }
}

const names = font.names
const out = {
  glyphs,
  familyName: names.fontFamily?.en ?? 'Federo',
  ascender,
  descender,
  underlinePosition: Math.round((font.tables.post?.underlinePosition ?? -100) * scale),
  underlineThickness: Math.round((font.tables.post?.underlineThickness ?? 50) * scale),
  boundingBox: {
    xMin: Math.round(font.tables.head.xMin * scale),
    yMin: Math.round(font.tables.head.yMin * scale),
    xMax: Math.round(font.tables.head.xMax * scale),
    yMax: Math.round(font.tables.head.yMax * scale),
  },
  resolution: 1000,
  cssFontWeight: 'normal',
  cssFontStyle: 'normal',
  original_font_information: {
    postscript_name: names.postScriptName?.en ?? 'Federo-Regular',
    font_family_name: names.fontFamily?.en ?? 'Federo',
    font_sub_family_name: names.fontSubfamily?.en ?? 'Regular',
    full_font_name: names.fullName?.en ?? 'Federo Regular',
  },
}

fs.writeFileSync(outputPath, JSON.stringify(out))
console.log(`Wrote ${Object.keys(glyphs).length} glyphs → ${outputPath}`)
