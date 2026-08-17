import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DOMParser } from 'linkedom'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import {
  IworkContainerMismatchError,
  parseIworkDocument,
} from '../packages/iwork-viewer/src/parser'
import { decompressIwaFile } from '../packages/iwork-viewer/src/snappy'

const fixtureRoot = join(process.cwd(), 'test/fixtures')
const readFixture = (path: string) => {
  const bytes = readFileSync(join(fixtureRoot, path))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
const parser = () => new DOMParser() as unknown as DOMParser
const manifest = JSON.parse(readFileSync(join(fixtureRoot, 'manifest.json'), 'utf8')) as {
  licensedCorpus: { licenseFile: string; licenseSha256: string }
  fixtures: Record<string, { sha256: string; goldens?: Array<{ path: string; sha256: string }> }>
}
const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')

describe('Apple iWork format matrix', () => {
  it.each([
    ['pages/iwork-09.pages', 'pages', 'iwork-09', 'iWork 09 Pages fixture'],
    ['pages/iwork-2013-plus.pages', 'pages', 'iwork-2013-plus', 'Modern Pages fixture'],
    ['numbers/iwork-09.numbers', 'numbers', 'iwork-09', 'Saved total'],
    ['numbers/iwork-2013-plus.numbers', 'numbers', 'iwork-2013-plus', 'Modern Numbers fixture'],
    ['keynote/iwork-09.key', 'key', 'iwork-09', 'Speaker note fixture'],
    ['keynote/iwork-2013-plus.key', 'key', 'iwork-2013-plus', 'Modern Keynote fixture'],
  ])('parses %s as %s', async (path, type, generation, expectedText) => {
    const model = await parseIworkDocument(readFixture(path), type, {}, parser)
    expect(model.generation).toBe(generation)
    expect(model.scenes.length).toBeGreaterThan(0)
    const text = model.scenes.flatMap(scene => [scene.name, ...scene.blocks.map(block => block.text), ...scene.notes, ...scene.tables.flatMap(table => table.rows.flat())]).join(' ')
    expect(text).toContain(expectedText)
  })

  it('keeps an untyped synthetic IWA object graph on the explicit limited-preview path', async () => {
    const model = await parseIworkDocument(readFixture('pages/iwork-2013-plus.pages'), 'pages', {}, parser)
    expect(model.generation).toBe('iwork-2013-plus')
    expect(model.limitedPreview).toBe(true)
    expect(model.diagnostics.join(' ')).toContain('generic IWA object graph')
  })

  it('routes an OOXML file renamed to .numbers by its real container signature', async () => {
    const ooxml = new JSZip()
    ooxml.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
    ooxml.file('xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"/>')
    const buffer = await ooxml.generateAsync({ type: 'arraybuffer' })
    await expect(parseIworkDocument(buffer, 'numbers', {}, parser)).rejects.toMatchObject({
      name: 'IworkContainerMismatchError',
      actualRendererId: 'spreadsheet-openxml',
    } satisfies Partial<IworkContainerMismatchError>)
  })

  it('parses the current Apple Pages fixture with page and object assertions', async () => {
    const model = await parseIworkDocument(readFixture('pages/current-pages-15.3.1.pages'), 'pages', {}, parser)
    expect(model.generation).toBe('iwork-2013-plus')
    expect(model.scenes).toHaveLength(2)
    expect(model.scenes.flatMap(scene => scene.tables)).toHaveLength(1)
    const table = model.scenes.flatMap(scene => scene.tables)[0]
    expect(table?.rows).toHaveLength(5)
    expect(table?.rows.slice(0, 2)).toEqual([
      ['Item', 'Value', 'Status', 'Note'],
      ['Pages', '2', 'Native', ''],
    ])
    expect(table).toMatchObject({ headerRows: 1, headerColumns: 0 })
    const chart = model.scenes.flatMap(scene => scene.objects).find(object => object.kind === 'chart')
    expect(chart?.chart).toEqual({
      type: 'line',
      categories: ['四月', '五月', '六月', '七月'],
      series: [
        { name: '区域 1', values: [17, 26, 53, 96] },
        { name: '区域 2', values: [55, 43, 70, 58] },
      ],
    })
    expect(model.scenes.flatMap(scene => scene.objects).map(object => object.kind)).toEqual(expect.arrayContaining(['shape', 'chart', 'image', 'table']))
    expect(model.scenes.flatMap(scene => scene.blocks.map(block => block.text)).join(' ')).toContain('PAGES-CURRENT-15-3-1')
    expect(model.limitedPreview).toBe(false)
  })

  it('parses only document slides from the current Apple Keynote fixture', async () => {
    const model = await parseIworkDocument(readFixture('keynote/current-keynote-15.3.1.key'), 'key', {}, parser)
    expect(model.generation).toBe('iwork-2013-plus')
    expect(model.scenes).toHaveLength(2)
    expect(model.scenes.map(scene => scene.name)).toEqual(['File Viewer Keynote Fidelity Matrix', 'Static Fidelity Objects'])
    expect(model.scenes.flatMap(scene => scene.tables)[0]?.rows).toHaveLength(3)
    expect(model.scenes.flatMap(scene => scene.objects).map(object => object.kind)).toEqual(expect.arrayContaining(['shape', 'chart', 'image', 'table']))
    const title = model.scenes[0]?.blocks.find(block => block.text === 'File Viewer Keynote Fidelity Matrix')
    expect(title).toMatchObject({
      fontSize: 116,
      fontFamily: 'Helvetica Neue',
      bold: true,
      align: 'left',
      verticalAlign: 'bottom',
    })
    expect(title?.lineHeight).toBeCloseTo(1, 4)
    expect(model.scenes[0]?.blocks.find(block => block.text.startsWith('Native shapes'))).toMatchObject({
      fontSize: 55,
      fontFamily: 'Helvetica Neue',
      bold: true,
      verticalAlign: 'top',
    })
    expect(model.scenes[0]?.blocks.find(block => block.text.startsWith('Current IWA fixture'))).toMatchObject({
      fontSize: 36,
      fontFamily: 'Helvetica Neue',
      bold: true,
      verticalAlign: 'top',
    })
    const text = model.scenes.flatMap(scene => [...scene.blocks.map(block => block.text), ...scene.notes]).join(' ')
    expect(text).toContain('KEYNOTE-CURRENT-15-3-1')
    expect(text).toContain('KEYNOTE-NOTES-CURRENT-15-3-1')
    expect(model.limitedPreview).toBe(false)
  })

  it('parses the current Apple Numbers fixture with multiple sheets, cached formula results and chart geometry', async () => {
    const model = await parseIworkDocument(readFixture('numbers/current-numbers-15.3.1.numbers'), 'numbers', {}, parser)
    expect(model.generation).toBe('iwork-2013-plus')
    expect(model.scenes.map(scene => scene.name)).toEqual(['工作表 1', '工作表 2'])
    expect(model.scenes.flatMap(scene => scene.tables)).toHaveLength(2)
    expect(model.scenes.map(scene => scene.tables[0]?.rows.length)).toEqual([22, 10])
    expect(model.limitedPreview).toBe(false)
    expect(model.scenes.map(scene => [scene.width, scene.height])).toEqual([[832, 792], [636, 792]])
    expect(model.scenes[0]?.tables[0]).toMatchObject({ headerRows: 1, headerColumns: 1 })
    expect(model.scenes[0]?.tables[0]?.rowHeights?.[4]).toBeCloseTo(43.709930419921875, 5)
    const cells = model.scenes.flatMap(scene => scene.tables.flatMap(table => table.rows.flat()))
    expect(cells.join(' ')).toContain('NUMBERS-CURRENT-15-3-1')
    expect(cells).toContain('30')
    const chart = model.scenes[1]?.objects.find(object => object.kind === 'chart')
    expect(chart?.chart?.categories).toEqual(['四月', '五月', '六月', '七月'])
    expect(chart?.chart?.type).toBe('bar')
    expect(chart?.chart?.series.map(series => series.values)).toEqual([[17, 26, 53, 96], [55, 43, 70, 58]])
    expect(model.limits.join(' ')).toContain('not recalculated')
  })

  it('parses the licensed Pages 4 and Pages 5 historical corpus with exact page geometry and text', async () => {
    const pages4 = await parseIworkDocument(readFixture('pages/libetonyek-pages4-iwork09.pages'), 'pages', {}, parser)
    expect(pages4.generation).toBe('iwork-09')
    expect(pages4.scenes).toHaveLength(1)
    expect(pages4.scenes[0]).toMatchObject({ width: 595, height: 842 })
    // The Pages 4 corpus stores Lorem Ipsum in a section prototype while the
    // live document body is empty. Current Pages exports an empty page, so the
    // renderer must not expose template text as visible/searchable content.
    expect(pages4.scenes[0]?.blocks).toHaveLength(0)

    const pages5 = await parseIworkDocument(readFixture('pages/libetonyek-pages5-2015.pages'), 'pages', {}, parser)
    expect(pages5.generation).toBe('iwork-2013-plus')
    expect(pages5.scenes).toHaveLength(1)
    expect(pages5.scenes[0]).toMatchObject({ width: 595.28, height: 841.89 })
    expect(pages5.scenes[0]?.blocks.map(block => block.text).join(' ')).toContain('My hovercraft is full of eels')
  })

  it('parses the licensed Numbers 2 and Numbers 3 corpus without leaking implementation layer names', async () => {
    const numbers2 = await parseIworkDocument(readFixture('numbers/libetonyek-numbers2-iwork09.numbers'), 'numbers', {}, parser)
    expect(numbers2.generation).toBe('iwork-09')
    expect(numbers2.scenes).toHaveLength(1)
    expect(numbers2.scenes[0]?.name).toBe('Sheet 1')
    expect(numbers2.scenes[0]?.blocks).toEqual([])
    expect(numbers2.scenes[0]?.tables).toHaveLength(1)
    expect(numbers2.scenes[0]?.tables[0]?.rows).toHaveLength(45)
    expect(numbers2.scenes[0]?.tables[0]?.rows[0]).toHaveLength(11)
    expect(numbers2.scenes[0]?.width).toBeCloseTo(1080.433, 3)
    expect(numbers2.scenes[0]?.height).toBeCloseTo(807.75, 2)
    expect(numbers2.scenes[0]?.tables[0]).toMatchObject({
      x: 71,
      y: 71,
      headerRows: 1,
      headerColumns: 1,
      borderColor: '#d6d6d6',
    })
    expect(numbers2.scenes[0]?.tables[0]?.rowHeights?.reduce((sum, height) => sum + height, 0))
      .toBeCloseTo(663.75, 2)

    const numbers3 = await parseIworkDocument(readFixture('numbers/libetonyek-numbers3-2015.numbers'), 'numbers', {}, parser)
    expect(numbers3.generation).toBe('iwork-2013-plus')
    expect(numbers3.scenes).toHaveLength(1)
    expect(numbers3.scenes[0]?.name).toBe('Sheet 1')
    expect(numbers3.scenes[0]?.tables).toHaveLength(1)
    expect(numbers3.scenes[0]?.tables[0]?.rows).toHaveLength(3)
    expect(numbers3.scenes[0]?.tables[0]?.rows.every(row => row.length === 9)).toBe(true)
    expect(numbers3.scenes[0]?.tables[0]?.rows.flat()).toEqual(expect.arrayContaining(['automatic', '3400000', 'TRUE']))
  })

  it('parses the licensed Keynote 5 deck and preserves the blank Keynote 6 document slide', async () => {
    const keynote5 = await parseIworkDocument(readFixture('keynote/libetonyek-keynote5-iwork09.key'), 'key', {}, parser)
    expect(keynote5.generation).toBe('iwork-09')
    expect(keynote5.scenes).toHaveLength(2)
    expect(keynote5.scenes.every(scene => scene.width === 800 && scene.height === 600)).toBe(true)
    expect(keynote5.scenes.flatMap(scene => scene.blocks.map(block => block.text)).join(' ')).toContain('Title slide')
    expect(keynote5.scenes[1]?.blocks[0]).toMatchObject({
      x: 78,
      y: 16,
      width: 644,
      height: 150,
      fontSize: 64,
      fontFamily: 'GillSans',
      align: 'center',
      verticalAlign: 'middle',
    })
    expect(keynote5.scenes[1]?.blocks[0]?.paragraphs?.[0]?.runs.map(run => run.text).join(''))
      .toBe('Capitalized Title')
    expect(keynote5.scenes[1]?.blocks[1]).toMatchObject({ x: 78, y: 170, width: 644, height: 352, fontSize: 32 })
    expect(keynote5.scenes[1]?.blocks[1]?.paragraphs?.every(paragraph => paragraph.bullet)).toBe(true)
    expect(keynote5.scenes[1]?.blocks[1]?.paragraphs?.[0]?.runs).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: 'bold and ', bold: true }),
      expect.objectContaining({ text: 'italic', bold: true, italic: true }),
      expect.objectContaining({ text: ', continuing in italic only', italic: true }),
    ]))

    const keynote6 = await parseIworkDocument(readFixture('keynote/libetonyek-keynote6-2015.key'), 'key', {}, parser)
    expect(keynote6.generation).toBe('iwork-2013-plus')
    expect(keynote6.scenes).toHaveLength(1)
    expect(keynote6.scenes[0]).toMatchObject({ width: 1024, height: 768, blocks: [], tables: [], objects: [] })
  })

  it('pins every declared native fixture and golden by SHA-256', () => {
    expect(sha256(join(fixtureRoot, manifest.licensedCorpus.licenseFile)))
      .toBe(manifest.licensedCorpus.licenseSha256)
    for (const [fixture, evidence] of Object.entries(manifest.fixtures)) {
      expect(sha256(join(fixtureRoot, fixture)), fixture).toBe(evidence.sha256)
      for (const golden of evidence.goldens || []) {
        expect(sha256(join(fixtureRoot, golden.path)), golden.path).toBe(golden.sha256)
      }
    }
  })

  it('rejects malformed Snappy frame lengths and decompression-limit overflows', () => {
    expect(() => decompressIwaFile(Uint8Array.of(0, 9, 0, 0, 1), 1024)).toThrow(/frame length/i)
    const declaredFour = Uint8Array.of(0, 6, 0, 0, 4, 12, 65, 66, 67, 68)
    expect(() => decompressIwaFile(declaredFour, 3)).toThrow(/unsafe|limit/i)
  })

  it('rejects encrypted iwpv2 markers and unsafe ZIP/object limits', async () => {
    const encryptedZip = await JSZip.loadAsync(readFixture('pages/iwork-09.pages'))
    encryptedZip.file('Metadata/Document.iwpv2', Uint8Array.of(1))
    const encrypted = await encryptedZip.generateAsync({ type: 'arraybuffer' })
    await expect(parseIworkDocument(encrypted, 'pages', {}, parser)).rejects.toThrow(/encrypted.*iwpv2/i)

    const current = readFixture('pages/current-pages-15.3.1.pages')
    await expect(parseIworkDocument(current, 'pages', { maxObjects: 1 }, parser)).rejects.toThrow(/entry count|object count/i)

    const compressedZip = new JSZip()
    compressedZip.file('index.xml', '<sl:document xmlns:sl="urn:test"><sl:page><sl:p>safe text</sl:p></sl:page></sl:document>')
    compressedZip.file('Data/highly-compressible.bin', new Uint8Array(32_768))
    const compressed = await compressedZip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } })
    await expect(parseIworkDocument(compressed, 'pages', { maxCompressionRatio: 2 }, parser)).rejects.toThrow(/compression ratio/i)
  })

  it('rejects an embedded preview whose declared dimensions exceed the image-pixel limit', async () => {
    const zip = await JSZip.loadAsync(readFixture('pages/iwork-09.pages'))
    const pngHeader = Uint8Array.of(
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
      0, 0, 0x27, 0x10, 0, 0, 0x27, 0x10,
    )
    zip.file('QuickLook/Preview.png', pngHeader)
    const oversizedPreview = await zip.generateAsync({ type: 'arraybuffer' })
    await expect(parseIworkDocument(oversizedPreview, 'pages', { maxImagePixels: 1_000_000 }, parser))
      .rejects.toThrow(/image-pixel safety limit/i)
  })
})
