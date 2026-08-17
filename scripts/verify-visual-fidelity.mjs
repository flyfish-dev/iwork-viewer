import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { delimiter, extname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const demoRoot = resolve(process.env.IWORK_VISUAL_DEMO_DIR || '../file-viewer3-extract-iwork/apps/viewer-demo/dist')
const fixtureRoot = resolve('test/fixtures')
const manifestPath = join(fixtureRoot, 'manifest.json')
const outputRoot = resolve(process.env.IWORK_VISUAL_OUTPUT_DIR || 'output/iwork-fidelity')
const timeout = Number(process.env.IWORK_VISUAL_TIMEOUT || 60_000)

const thresholds = { pages: 0.03, numbers: 0.05, keynote: 0.03 }
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const cases = Object.entries(manifest.fixtures).flatMap(([fixture, evidence]) => {
  const goldens = (evidence.goldens || [])
    .filter(golden => golden.path.toLowerCase().endsWith('.png'))
    .map(golden => resolve(fixtureRoot, golden.path))
  if (!goldens.length) return []
  const kind = fixture.split('/')[0]
  if (!(kind in thresholds)) throw new Error(`Unknown iWork visual kind for ${fixture}.`)
  if (!evidence.demoSample) throw new Error(`${fixture} declares visual goldens without demoSample.`)
  return [{
    id: fixture.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, ''),
    fixture,
    goldens,
    kind,
    sample: evidence.demoSample,
    threshold: thresholds[kind],
  }]
})

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.wasm', 'application/wasm'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
])

const importPackage = async name => {
  try {
    return await import(name)
  } catch (originalError) {
    const roots = process.env.PATH
      ?.split(delimiter)
      .filter(entry => entry.endsWith(`${sep}node_modules${sep}.bin`))
      .map(entry => resolve(entry, '..'))
      .filter(existsSync) || []
    for (const root of roots) {
      try {
        return await import(pathToFileURL(require.resolve(name, { paths: [root] })).href)
      } catch {
        // npm exec can expose more than one temporary node_modules root.
      }
    }
    throw new Error(`Missing ${name}. Run this verifier through pnpm verify:iwork-visual-fidelity. ${originalError}`)
  }
}

const assertInputs = () => {
  if (!cases.length) throw new Error(`No PNG visual goldens are declared in ${manifestPath}.`)
  for (const file of ['index.html', ...cases.flatMap(item => item.goldens)]) {
    const path = file === 'index.html' ? join(demoRoot, file) : file
    if (!existsSync(path) || !statSync(path).isFile()) {
      throw new Error(`Missing ${path}. Run pnpm build-only and generate the declared Apple golden first.`)
    }
  }
  mkdirSync(outputRoot, { recursive: true })
}

const startServer = async () => {
  const server = createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1')
    const relativePath = decodeURIComponent(url.pathname) === '/'
      ? 'index.html'
      : decodeURIComponent(url.pathname).replace(/^\/+/, '')
    const path = resolve(demoRoot, relativePath)
    if (!path.startsWith(demoRoot) || relative(demoRoot, path).startsWith('..')) {
      response.writeHead(403).end('Forbidden')
      return
    }
    if (!existsSync(path) || !statSync(path).isFile()) {
      response.writeHead(404).end('Not Found')
      return
    }
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': mimeTypes.get(extname(path).toLowerCase()) || 'application/octet-stream',
    })
    createReadStream(path).pipe(response)
  })
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Could not resolve the iWork visual server address.')
  return { server, url: `http://127.0.0.1:${address.port}` }
}

const resizeRgba = (source, sourceWidth, sourceHeight, targetWidth, targetHeight) => {
  if (sourceWidth === targetWidth && sourceHeight === targetHeight) return Buffer.from(source)
  const target = Buffer.alloc(targetWidth * targetHeight * 4)
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = targetHeight === 1 ? 0 : y * (sourceHeight - 1) / (targetHeight - 1)
    const y0 = Math.floor(sourceY)
    const y1 = Math.min(sourceHeight - 1, y0 + 1)
    const fy = sourceY - y0
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = targetWidth === 1 ? 0 : x * (sourceWidth - 1) / (targetWidth - 1)
      const x0 = Math.floor(sourceX)
      const x1 = Math.min(sourceWidth - 1, x0 + 1)
      const fx = sourceX - x0
      const targetOffset = (y * targetWidth + x) * 4
      for (let channel = 0; channel < 4; channel += 1) {
        const top = source[(y0 * sourceWidth + x0) * 4 + channel] * (1 - fx) +
          source[(y0 * sourceWidth + x1) * 4 + channel] * fx
        const bottom = source[(y1 * sourceWidth + x0) * 4 + channel] * (1 - fx) +
          source[(y1 * sourceWidth + x1) * 4 + channel] * fx
        target[targetOffset + channel] = Math.round(top * (1 - fy) + bottom * fy)
      }
    }
  }
  return target
}

const run = async () => {
  assertInputs()
  const [playwrightModule, pngModule, pixelmatchModule] = await Promise.all([
    importPackage('playwright'),
    importPackage('pngjs'),
    importPackage('pixelmatch'),
  ])
  const { chromium } = playwrightModule.chromium ? playwrightModule : playwrightModule.default
  const PNG = pngModule.PNG || pngModule.default?.PNG
  const pixelmatch = pixelmatchModule.default || pixelmatchModule
  if (!PNG || typeof pixelmatch !== 'function') throw new Error('Could not initialize PNG comparison dependencies.')

  const { server, url } = await startServer()
  const browser = await chromium.launch({ headless: true })
  const results = []
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 })
    await page.addStyleTag({ content: '*{animation:none!important;transition:none!important}' }).catch(() => {})
    for (const item of cases) {
      const target = new URL('/index.html', url)
      target.searchParams.set('url', `/example/${item.sample}`)
      target.searchParams.set('smoke', `iwork-visual-${item.kind}`)
      await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout })
      await page.waitForSelector('.iwork-scene', { state: 'visible', timeout })
      await page.locator('.iwork-nav button').nth(item.goldens.length - 1).waitFor({ state: 'visible', timeout })
      const navCount = await page.locator('.iwork-nav button').count()
      if (navCount !== item.goldens.length) {
        throw new Error(`${item.kind} exposed ${navCount} scenes; expected ${item.goldens.length}.`)
      }

      for (const [index, goldenPath] of item.goldens.entries()) {
        if (item.kind !== 'pages') {
          await page.locator('.iwork-nav button').nth(index).click()
          await page.locator('.iwork-nav button').nth(index).waitFor({ state: 'visible', timeout })
        }
        const scene = item.kind === 'pages'
          ? page.locator('.iwork-scene').nth(index)
          : page.locator('.iwork-scene').first()
        await page.locator('[data-iwork-visual-capture]').evaluateAll(elements => elements.forEach(element => element.remove()))
        await scene.evaluate(element => {
          const host = document.createElement('div')
          host.dataset.iworkVisualCapture = 'true'
          host.style.position = 'absolute'
          host.style.inset = '0 auto auto 0'
          host.style.width = element.style.width
          host.style.height = element.style.height
          host.style.zIndex = '2147483647'
          const shadow = host.attachShadow({ mode: 'open' })
          element.getRootNode().querySelectorAll('style').forEach(style => shadow.appendChild(style.cloneNode(true)))
          const capture = element.cloneNode(true)
          capture.style.position = 'absolute'
          capture.style.inset = '0 auto auto 0'
          capture.style.boxShadow = 'none'
          // The product applies fit-to-width after load. Locator screenshots
          // use the untransformed layout box, so leaving that transform in
          // place would compare a scaled scene plus surrounding stage pixels.
          // Fidelity evidence is captured at the native scene size instead.
          capture.style.transform = 'none'
          capture.querySelectorAll('.iwork-limited').forEach(badge => { badge.style.display = 'none' })
          // Apple Keynote's slide-only PDF export intentionally excludes the
          // presenter-note panel. Notes remain a separate exact browser smoke
          // assertion and are not removed from the product renderer.
          capture.querySelectorAll('.iwork-notes').forEach(notes => { notes.style.display = 'none' })
          shadow.appendChild(capture)
          document.body.appendChild(host)
        })
        const capture = page.locator('[data-iwork-visual-capture]')
        await capture.locator('img').evaluateAll(images => Promise.all(images.map(image =>
          image.complete ? undefined : new Promise(resolveImage => image.addEventListener('load', resolveImage, { once: true }))
        )))
        const actualName = `${item.id}-${index + 1}-actual.png`
        const actualPath = join(outputRoot, actualName)
        await capture.screenshot({ path: actualPath, animations: 'disabled', timeout })
        await capture.evaluate(element => element.remove())

        const actual = PNG.sync.read(readFileSync(actualPath))
        const golden = PNG.sync.read(readFileSync(goldenPath))
        const normalized = resizeRgba(actual.data, actual.width, actual.height, golden.width, golden.height)
        const diff = new PNG({ width: golden.width, height: golden.height })
        const differentPixels = pixelmatch(
          normalized,
          golden.data,
          diff.data,
          golden.width,
          golden.height,
          { includeAA: false, threshold: 0.1 }
        )
        const diffPixelRatio = differentPixels / (golden.width * golden.height)
        const diffPath = join(outputRoot, `${item.id}-${index + 1}-diff.png`)
        writeFileSync(diffPath, PNG.sync.write(diff))
        results.push({
          actual: relative(process.cwd(), actualPath),
          actualSize: [actual.width, actual.height],
          diff: relative(process.cwd(), diffPath),
          diffPixelRatio,
          golden: relative(process.cwd(), goldenPath),
          goldenSize: [golden.width, golden.height],
          fixture: item.fixture,
          kind: item.kind,
          page: index + 1,
          passed: diffPixelRatio <= item.threshold,
          threshold: item.threshold,
        })
      }
    }
  } finally {
    await browser.close()
    await new Promise(resolveClose => server.close(resolveClose))
  }

  const reportPath = join(outputRoot, 'report.json')
  writeFileSync(reportPath, `${JSON.stringify({ viewport: [1440, 960], deviceScaleFactor: 2, results }, null, 2)}\n`)
  for (const result of results) {
    console.log(`[iwork-visual] ${result.kind} ${result.page}: ${(result.diffPixelRatio * 100).toFixed(2)}% / ${(result.threshold * 100).toFixed(0)}%`)
  }
  if (results.some(result => !result.passed)) {
    throw new Error(`Apple iWork visual fidelity gate failed. See ${relative(process.cwd(), reportPath)}.`)
  }
  console.log(`[iwork-visual] All Apple iWork pages passed. Report: ${relative(process.cwd(), reportPath)}`)
}

run().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exit(1)
})
