import { createReadStream, existsSync } from 'node:fs'
import { copyFile, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { chromium } from 'playwright'

const standalonePackage = JSON.parse(await readFile(resolve('packages/iwork-viewer/package.json'), 'utf8'))
const tarball = resolve(`.release/packages/iwork-viewer-${standalonePackage.version}.tgz`)
if (!existsSync(tarball)) throw new Error('Missing standalone tarball. Run pnpm pack:local first.')
const temporaryRoot = await mkdtemp(join(tmpdir(), 'iwork-viewer-standalone-'))
const fixtures = [
  {
    file: 'sample.pages',
    source: 'test/fixtures/pages/current-pages-15.3.1.pages',
    type: 'pages',
    scenes: 2,
    text: 'PAGES-CURRENT-15-3-1',
  },
  {
    file: 'sample.numbers',
    source: 'test/fixtures/numbers/current-numbers-15.3.1.numbers',
    type: 'numbers',
    scenes: 2,
    text: 'NUMBERS-CURRENT-15-3-1',
  },
  {
    file: 'sample.key',
    source: 'test/fixtures/keynote/current-keynote-15.3.1.key',
    type: 'key',
    scenes: 2,
    text: 'File Viewer Keynote Fidelity Matrix',
  },
]
const workerRequests = []

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: temporaryRoot, encoding: 'utf8', stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed.`)
}

const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.pages', 'application/octet-stream'],
  ['.numbers', 'application/octet-stream'],
  ['.key', 'application/octet-stream'],
])

try {
  await writeFile(join(temporaryRoot, 'package.json'), JSON.stringify({
    private: true,
    type: 'module',
    dependencies: { 'iwork-viewer': `file:${tarball}` },
  }, null, 2))
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'])
  await mkdir(join(temporaryRoot, 'public'))
  for (const fixture of fixtures) {
    await copyFile(resolve(fixture.source), join(temporaryRoot, 'public', fixture.file))
  }
  await writeFile(join(temporaryRoot, 'public/index.html'), '<!doctype html><html><body><main id="viewers"></main><script type="module" src="/main.js"></script></body></html>')
  await writeFile(join(temporaryRoot, 'public/main.js'), `
    import { renderIworkDocument } from '/node_modules/iwork-viewer/dist/index.js';
    const fixtures = ${JSON.stringify(fixtures.map(({ file, type }) => ({ file, type })))};
    const results = [];
    for (const fixture of fixtures) {
      const target = document.createElement('div');
      target.dataset.fixture = fixture.file;
      target.style.cssText = 'width:1200px;height:900px';
      document.querySelector('#viewers').appendChild(target);
      const response = await fetch('/' + fixture.file);
      const viewer = await renderIworkDocument(await response.arrayBuffer(), target, fixture.type);
      viewer.fit('width');
      results.push({
        file: fixture.file,
        scenes: viewer.model.scenes.length,
        text: [...target.querySelectorAll('.iwork-text, .iwork-table, .iwork-notes')]
          .map((element) => element.textContent || '')
          .join(' '),
        zoom: viewer.getZoomState().scale,
      });
    }
    window.__IWORK_VIEWER_SMOKE__ = { ready: true, results };
  `)

  const root = join(temporaryRoot, 'public')
  const server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname)
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
    const path = relative.startsWith('node_modules/')
      ? resolve(temporaryRoot, relative)
      : resolve(root, relative)
    if (!path.startsWith(temporaryRoot) || !existsSync(path) || !(await stat(path)).isFile()) {
      response.writeHead(404).end('Not Found')
      return
    }
    if (path.endsWith('iwork.worker.js')) workerRequests.push(path)
    response.writeHead(200, { 'content-type': mime.get(extname(path)) || 'text/javascript; charset=utf-8' })
    createReadStream(path).pipe(response)
  })
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Could not resolve standalone smoke server.')
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 960 } })
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.__IWORK_VIEWER_SMOKE__?.ready === true, null, { timeout: 60_000 })
    const results = await page.evaluate(() => window.__IWORK_VIEWER_SMOKE__.results)
    for (const fixture of fixtures) {
      const result = results.find(item => item.file === fixture.file)
      if (!result || result.scenes !== fixture.scenes || !result.text.includes(fixture.text) || !(result.zoom > 0)) {
        throw new Error(`Standalone viewer assertion failed for ${fixture.file}: ${JSON.stringify(result)}`)
      }
    }
    if (workerRequests.length < 1) throw new Error('The standalone viewer did not request its packaged Worker.')
    console.log('[iwork-viewer] Standalone tarball rendered native Pages, Numbers, and Keynote documents through its packaged Worker.')
  } finally {
    await browser.close()
    await new Promise(resolveClose => server.close(resolveClose))
  }
} finally {
  await rm(temporaryRoot, { force: true, recursive: true })
}
