'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const projectRoot = path.resolve(__dirname, '..')
const distDirectory = path.join(projectRoot, 'dist')
const releaseDirectory = path.join(projectRoot, 'release')
const workDirectory = path.join(releaseDirectory, '.windows-exe-build')
const primaryOutputExecutable = path.join(releaseDirectory, 'UAV Log Viewer.exe')
let outputExecutable = primaryOutputExecutable

const fail = message => {
    throw new Error(message)
}

const run = (command, args) => {
    const result = spawnSync(command, args, {
        cwd: projectRoot,
        stdio: 'inherit',
        windowsHide: true
    })
    if (result.error) throw result.error
    if (result.status !== 0) fail(`${path.basename(command)} exited with code ${result.status}.`)
}

const requireSupportedNode = () => {
    const [major, minor] = process.versions.node.split('.').map(Number)
    if (process.platform !== 'win32') fail('The Windows package must be built on Windows.')
    if (major < 20 || (major === 20 && minor < 12)) {
        fail('Packaging requires Node.js 20.12 or newer so web assets can be embedded in the EXE.')
    }
}

const listFiles = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath]
})

const buildSite = () => {
    const npmCli = process.env.npm_execpath
    if (!npmCli) fail('Run this command through npm: npm run package:windows')
    if (path.dirname(distDirectory) !== projectRoot) fail('Refusing to clean an unexpected build directory.')
    fs.rmSync(distDirectory, { recursive: true, force: true })
    run(process.execPath, [npmCli, 'run', 'build'])
}

const createSeaConfig = () => {
    const files = listFiles(distDirectory).filter(file => !file.endsWith('.gz'))
    const assets = {}
    const assetPaths = []
    for (const file of files) {
        const requestPath = '/' + path.relative(distDirectory, file).split(path.sep).join('/')
        if (requestPath === '/runtime-config.js') continue
        assets[requestPath] = file
        assetPaths.push(requestPath)
    }
    assetPaths.sort()

    const manifestPath = path.join(workDirectory, 'asset-manifest.json')
    fs.writeFileSync(manifestPath, JSON.stringify(assetPaths))
    const manifestAssetKey = '__asset_manifest__'
    assets[manifestAssetKey] = manifestPath

    const blobPath = path.join(workDirectory, 'uav-log-viewer.blob')
    const configPath = path.join(workDirectory, 'sea-config.json')
    fs.writeFileSync(configPath, JSON.stringify({
        main: path.join(__dirname, 'windows-exe-server.js'),
        output: blobPath,
        disableExperimentalSEAWarning: true,
        useCodeCache: false,
        assets
    }, null, 2))
    return { assetCount: assetPaths.length, blobPath, configPath }
}

const packageExecutable = ({ blobPath, configPath }) => {
    run(process.execPath, ['--experimental-sea-config', configPath])
    fs.copyFileSync(process.execPath, outputExecutable)
    const postjectCli = require.resolve('postject/dist/cli.js')
    run(process.execPath, [
        postjectCli,
        outputExecutable,
        'NODE_SEA_BLOB',
        blobPath,
        '--sentinel-fuse',
        'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'
    ])
}

const prepareOutputExecutable = () => {
    for (let suffix = 0; suffix < 100; suffix++) {
        const filename = suffix === 0
            ? 'UAV Log Viewer.exe'
            : `UAV Log Viewer updated${suffix === 1 ? '' : ` ${suffix}`}.exe`
        const candidate = path.join(releaseDirectory, filename)
        try {
            fs.rmSync(candidate, { force: true })
            outputExecutable = candidate
            if (suffix > 0) {
                console.warn(`Earlier EXEs are running; writing this build to ${outputExecutable}.`)
            }
            return
        } catch (error) {
            if (error.code !== 'EPERM') throw error
        }
    }
    fail('Close an existing UAV Log Viewer EXE before packaging another update.')
}

const main = () => {
    requireSupportedNode()
    fs.mkdirSync(releaseDirectory, { recursive: true })
    fs.rmSync(workDirectory, { recursive: true, force: true })
    prepareOutputExecutable()
    fs.mkdirSync(workDirectory, { recursive: true })

    try {
        buildSite()
        const seaConfig = createSeaConfig()
        packageExecutable(seaConfig)
        const sizeMiB = (fs.statSync(outputExecutable).size / 1024 / 1024).toFixed(1)
        console.log(`Packaged ${seaConfig.assetCount} files in ${outputExecutable} (${sizeMiB} MiB).`)
    } finally {
        fs.rmSync(workDirectory, { recursive: true, force: true })
    }
}

main()
