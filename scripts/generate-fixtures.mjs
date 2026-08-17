import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import JSZip from 'jszip'

const encodeVarint = value => {
  const output = []
  let current = value
  do {
    let byte = current & 0x7f
    current = Math.floor(current / 128)
    if (current) byte |= 0x80
    output.push(byte)
  } while (current)
  return Uint8Array.from(output)
}

const concatenate = (...chunks) => {
  const output = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}

const protobufStrings = values => concatenate(...values.map((value, index) => {
  const payload = new TextEncoder().encode(value)
  return concatenate(encodeVarint((index + 1) * 8 + 2), encodeVarint(payload.length), payload)
}))

const snappyLiteralFrame = payload => {
  const declared = encodeVarint(payload.length)
  const literal = payload.length <= 60
    ? Uint8Array.of((payload.length - 1) << 2)
    : payload.length <= 256
      ? Uint8Array.of(240, payload.length - 1)
      : Uint8Array.of(244, (payload.length - 1) & 0xff, ((payload.length - 1) >> 8) & 0xff)
  const body = concatenate(declared, literal, payload)
  return concatenate(Uint8Array.of(0, body.length & 0xff, (body.length >> 8) & 0xff, (body.length >> 16) & 0xff), body)
}

const onePixelPng = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
))
const fixtureRoot = resolve('test/fixtures')
const fixtures = [
  {
    folder: 'pages',
    extension: 'pages',
    legacyIndex: 'index.xml',
    legacyXml: '<?xml version="1.0"?><document><page name="Page 1"><p>iWork 09 Pages fixture</p><p>Searchable page text</p></page></document>',
    modernStrings: ['Modern Pages fixture', 'Searchable IWA text', 'Static page object'],
  },
  {
    folder: 'numbers',
    extension: 'numbers',
    legacyIndex: 'index.xml',
    legacyXml: '<?xml version="1.0"?><document><sheet name="Budget"><table><row><cell>Item</cell><cell>Value</cell></row><row><cell>Saved total</cell><number-cell>42</number-cell></row></table></sheet></document>',
    modernStrings: ['Modern Numbers fixture', 'Budget', 'Saved value 42'],
  },
  {
    folder: 'keynote',
    extension: 'key',
    legacyIndex: 'index.apxl',
    legacyXml: '<?xml version="1.0"?><presentation><slide name="Opening"><p>iWork 09 Keynote fixture</p><p>Static shape label</p><notes>Speaker note fixture</notes></slide></presentation>',
    modernStrings: ['Modern Keynote fixture', 'Static slide object', 'Speaker note text'],
  },
]

for (const fixture of fixtures) {
  const folder = join(fixtureRoot, fixture.folder)
  await mkdir(folder, { recursive: true })
  const legacyZip = new JSZip()
  legacyZip.file(fixture.legacyIndex, fixture.legacyXml)
  legacyZip.file('QuickLook/Thumbnail.png', onePixelPng)
  await writeFile(
    join(folder, `iwork-09.${fixture.extension}`),
    await legacyZip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  )
  const modernZip = new JSZip()
  modernZip.file('Index/Document.iwa', snappyLiteralFrame(protobufStrings(fixture.modernStrings)))
  modernZip.file('preview.png', onePixelPng)
  await writeFile(
    join(folder, `iwork-2013-plus.${fixture.extension}`),
    await modernZip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  )
}

console.log('[iwork-viewer] Generated synthetic iWork 09 and IWA fixtures.')
