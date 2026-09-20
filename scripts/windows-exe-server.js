'use strict'

const http = require('node:http')
const https = require('node:https')
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const sea = require('node:sea')

const preferredPort = 8680

const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.glb': 'model/gltf-binary',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.terrain': 'application/vnd.quantized-mesh',
    '.ttf': 'font/ttf',
    '.wasm': 'application/wasm',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.xml': 'application/xml; charset=utf-8'
}

const extensionOf = requestPath => {
    const filename = requestPath.slice(requestPath.lastIndexOf('/') + 1)
    const dot = filename.lastIndexOf('.')
    return dot === -1 ? '' : filename.slice(dot).toLowerCase()
}

const contentTypeFor = requestPath => mimeTypes[extensionOf(requestPath)] || 'application/octet-stream'

const normaliseRequestPath = requestUrl => {
    try {
        const pathname = decodeURIComponent(new URL(requestUrl, 'http://127.0.0.1').pathname)
        if (pathname.includes('\0') || pathname.includes('\\')) return null
        return pathname === '/' ? '/index.html' : pathname
    } catch (error) {
        return null
    }
}

const runtimeConfig = () => 'window.__APP_CONFIG__ = Object.assign({}, window.__APP_CONFIG__, {\n' +
    `  VUE_APP_CESIUM_TOKEN: ${JSON.stringify(process.env.VUE_APP_CESIUM_TOKEN || '')},\n` +
    '  WINDOWS_EXE: true,\n' +
    "  PRESET_FOLDER_NAME: 'presets (next to the EXE)'\n" +
    '});\n'

const presetFilenamePattern = /\.uavlog-preset\.json$/i

const presetFilePath = (presetDirectory, relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath) return null
    const segments = relativePath.replace(/\\/g, '/').split('/')
    if (segments.some(segment => !segment || segment === '.' || segment === '..')) return null
    if (!presetFilenamePattern.test(segments[segments.length - 1])) return null
    if (segments.length > 2 || (segments.length === 2 && segments[0] !== 'backups')) return null
    const resolved = path.resolve(presetDirectory, ...segments)
    const root = path.resolve(presetDirectory)
    return resolved.startsWith(root + path.sep) ? resolved : null
}

const readRequestBody = request => new Promise((resolve, reject) => {
    const chunks = []
    let length = 0
    request.on('data', chunk => {
        length += chunk.length
        if (length > 5 * 1024 * 1024) {
            reject(new Error('Preset file is too large.'))
            request.destroy()
            return
        }
        chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
})

const handlePresetApi = async (request, response, presetDirectory) => {
    const requestUrl = new URL(request.url, 'http://127.0.0.1')
    if (requestUrl.pathname === '/api/presets' && request.method === 'GET') {
        fs.mkdirSync(presetDirectory, { recursive: true })
        const files = fs.readdirSync(presetDirectory, { withFileTypes: true })
            .filter(entry => entry.isFile() && presetFilenamePattern.test(entry.name))
            .map(entry => entry.name)
            .sort((left, right) => left.localeCompare(right))
        const body = Buffer.from(JSON.stringify(files))
        response.writeHead(200, {
            'Cache-Control': 'no-store',
            'Content-Length': body.length,
            'Content-Type': 'application/json; charset=utf-8'
        })
        response.end(body)
        return
    }

    if (requestUrl.pathname !== '/api/presets/file') {
        response.writeHead(404)
        response.end('Not found')
        return
    }
    const filePath = presetFilePath(presetDirectory, requestUrl.searchParams.get('path'))
    if (!filePath) {
        response.writeHead(400)
        response.end('Invalid preset path')
        return
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
        try {
            const body = fs.readFileSync(filePath)
            response.writeHead(200, {
                'Cache-Control': 'no-store',
                'Content-Length': body.length,
                'Content-Type': 'application/json; charset=utf-8'
            })
            response.end(request.method === 'HEAD' ? undefined : body)
        } catch (error) {
            response.writeHead(error.code === 'ENOENT' ? 404 : 500)
            response.end(error.code === 'ENOENT' ? 'Not found' : error.message)
        }
        return
    }

    if (request.method === 'PUT') {
        try {
            const body = await readRequestBody(request)
            fs.mkdirSync(path.dirname(filePath), { recursive: true })
            fs.writeFileSync(filePath, body)
            response.writeHead(204)
            response.end()
        } catch (error) {
            if (!response.headersSent) response.writeHead(500)
            response.end(error.message)
        }
        return
    }

    if (request.method === 'DELETE') {
        try {
            fs.rmSync(filePath)
            response.writeHead(204)
            response.end()
        } catch (error) {
            response.writeHead(error.code === 'ENOENT' ? 404 : 500)
            response.end(error.code === 'ENOENT' ? 'Not found' : error.message)
        }
        return
    }

    response.writeHead(405, { Allow: 'GET, HEAD, PUT, DELETE' })
    response.end()
}

const proxyOnlineAsset = (request, response, requestPath) => {
    const upstreamUrl = new URL(requestPath, 'https://plot.ardupilot.org')
    const upstream = https.get(upstreamUrl, {
        headers: {
            Accept: request.headers.accept || '*/*',
            'User-Agent': 'UAV-Log-Viewer-Windows'
        }
    }, upstreamResponse => {
        const headers = {}
        for (const name of [
            'cache-control', 'content-encoding', 'content-length', 'content-type',
            'etag', 'last-modified'
        ]) {
            if (upstreamResponse.headers[name] !== undefined) headers[name] = upstreamResponse.headers[name]
        }
        response.writeHead(upstreamResponse.statusCode || 502, headers)
        upstreamResponse.pipe(response)
    })
    upstream.setTimeout(15000, () => upstream.destroy(new Error('Online map request timed out.')))
    upstream.on('error', error => {
        if (!response.headersSent) {
            response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
        }
        response.end(`Online map data unavailable: ${error.message}`)
    })
}

const createRequestHandler = (
    assetPaths, getAsset, proxyRequest = proxyOnlineAsset, presetDirectory = null
) => (request, response) => {
    if (presetDirectory && request.url.startsWith('/api/presets')) {
        handlePresetApi(request, response, presetDirectory).catch(error => {
            if (!response.headersSent) response.writeHead(500)
            response.end(error.message)
        })
        return
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405, { Allow: 'GET, HEAD' })
        response.end()
        return
    }

    const requestPath = normaliseRequestPath(request.url)
    if (!requestPath) {
        response.writeHead(400)
        response.end('Bad request')
        return
    }

    if (requestPath.startsWith('/quantized/') || requestPath.startsWith('/eniro/')) {
        proxyRequest(request, response, requestPath)
        return
    }

    let body
    let contentType
    if (requestPath === '/runtime-config.js') {
        body = Buffer.from(runtimeConfig())
        contentType = mimeTypes['.js']
    } else if (assetPaths.has(requestPath)) {
        body = Buffer.from(getAsset(requestPath))
        contentType = contentTypeFor(requestPath)
    } else {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        response.end('Not found')
        return
    }

    const cacheControl = requestPath === '/index.html' || requestPath === '/runtime-config.js'
        ? 'no-store'
        : 'public, max-age=31536000, immutable'
    response.writeHead(200, {
        'Cache-Control': cacheControl,
        'Content-Length': body.length,
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff'
    })
    response.end(request.method === 'HEAD' ? undefined : body)
}

const openBrowser = url => {
    const child = spawn('cmd.exe', ['/d', '/c', 'start', '', url], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
    })
    child.unref()
}

const listenWithFallback = (server, onListening, port = preferredPort) => {
    let usedFallback = false
    server.on('error', error => {
        if (error.code === 'EADDRINUSE' && !usedFallback) {
            usedFallback = true
            console.warn(`Port ${port} is already in use; selecting a temporary port.`)
            server.listen(0, '127.0.0.1', onListening)
            return
        }
        console.error(`Unable to start UAV Log Viewer: ${error.message}`)
        process.exitCode = 1
    })
    server.listen(port, '127.0.0.1', onListening)
}

const start = () => {
    if (!sea.isSea()) throw new Error('This server must be run from the packaged executable.')

    process.title = 'UAV Log Viewer'
    const assetPaths = new Set(JSON.parse(sea.getAsset('__asset_manifest__', 'utf8')))
    const presetDirectory = path.join(path.dirname(process.execPath), 'presets')
    const server = http.createServer(createRequestHandler(assetPaths, sea.getAsset, proxyOnlineAsset, presetDirectory))
    listenWithFallback(server, () => {
        const address = server.address()
        const url = `http://127.0.0.1:${address.port}/`
        console.log(`UAV Log Viewer is running at ${url}`)
        console.log('Close this window to stop it.')
        if (!process.argv.includes('--no-open')) openBrowser(url)
    })
}

if (sea.isSea()) start()

module.exports = {
    contentTypeFor,
    createRequestHandler,
    handlePresetApi,
    listenWithFallback,
    normaliseRequestPath,
    preferredPort,
    presetFilePath,
    proxyOnlineAsset,
    runtimeConfig
}
