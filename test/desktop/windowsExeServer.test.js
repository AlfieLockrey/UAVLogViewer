'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')
const {
    contentTypeFor,
    createRequestHandler,
    listenWithFallback,
    normaliseRequestPath,
    presetFilePath
} = require('../../scripts/windows-exe-server.js')

const makeResponse = () => ({
    body: null,
    headers: null,
    status: null,
    writeHead (status, headers) {
        this.status = status
        this.headers = headers || {}
    },
    end (body) {
        this.body = body
    }
})

test('maps the root request to the embedded index', () => {
    assert.equal(normaliseRequestPath('/'), '/index.html')
    assert.equal(normaliseRequestPath('/static/js/app.js?cache=1'), '/static/js/app.js')
})

test('serves embedded files with their browser content type', () => {
    const handler = createRequestHandler(new Set(['/index.html']), key => Buffer.from(`asset:${key}`))
    const response = makeResponse()
    handler({ method: 'GET', url: '/' }, response)

    assert.equal(response.status, 200)
    assert.equal(response.headers['Content-Type'], 'text/html; charset=utf-8')
    assert.equal(response.body.toString(), 'asset:/index.html')
    assert.equal(contentTypeFor('/Workers/parser.wasm'), 'application/wasm')
})

test('does not expose files that were not embedded', () => {
    const handler = createRequestHandler(new Set(), () => assert.fail('asset lookup should not run'))
    const response = makeResponse()
    handler({ method: 'GET', url: '/missing.txt' }, response)

    assert.equal(response.status, 404)
})

test('forwards online terrain requests through the local server', () => {
    let forwardedPath = null
    const proxy = (_request, _response, requestPath) => { forwardedPath = requestPath }
    const handler = createRequestHandler(new Set(), () => assert.fail('asset lookup should not run'), proxy)
    handler({ method: 'GET', url: '/quantized/layer.json' }, makeResponse())

    assert.equal(forwardedPath, '/quantized/layer.json')
})

test('keeps preset API paths inside the portable preset folder', () => {
    const directory = path.join('C:', 'viewer', 'presets')
    assert.equal(presetFilePath(directory, '../outside.uavlog-preset.json'), null)
    assert.equal(presetFilePath(directory, 'nested/file.uavlog-preset.json'), null)
    assert.match(presetFilePath(directory, 'backups/example.uavlog-preset.json'), /example\.uavlog-preset\.json$/)
})

test('writes and reloads presets beside the packaged executable', async t => {
    const presetDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'uav-presets-'))
    t.after(() => fs.rmSync(presetDirectory, { recursive: true, force: true }))
    const startServer = async () => {
        const handler = createRequestHandler(new Set(), () => assert.fail('asset lookup should not run'), undefined,
            presetDirectory)
        const server = http.createServer(handler)
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
        return { server, origin: `http://127.0.0.1:${server.address().port}` }
    }
    let running = await startServer()
    const filename = encodeURIComponent('Cruise.uavlog-preset.json')
    const contents = JSON.stringify({ name: 'Cruise' })

    const writeResponse = await fetch(`${running.origin}/api/presets/file?path=${filename}`, {
        method: 'PUT',
        body: contents
    })
    assert.equal(writeResponse.status, 204)
    await new Promise(resolve => running.server.close(resolve))

    running = await startServer()
    t.after(() => running.server.close())

    const listResponse = await fetch(`${running.origin}/api/presets`)
    assert.deepEqual(await listResponse.json(), ['Cruise.uavlog-preset.json'])

    const readResponse = await fetch(`${running.origin}/api/presets/file?path=${filename}`)
    assert.equal(await readResponse.text(), contents)
})

test('uses a temporary port only when the preferred port is occupied', async t => {
    const blocker = http.createServer()
    await new Promise(resolve => blocker.listen(0, '127.0.0.1', resolve))
    t.after(() => blocker.close())
    const occupiedPort = blocker.address().port
    const server = http.createServer((_request, response) => response.end())
    await new Promise(resolve => listenWithFallback(server, resolve, occupiedPort))
    t.after(() => server.close())

    assert.notEqual(server.address().port, occupiedPort)
})
