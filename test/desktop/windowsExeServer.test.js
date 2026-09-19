'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
    contentTypeFor,
    createRequestHandler,
    normaliseRequestPath
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
