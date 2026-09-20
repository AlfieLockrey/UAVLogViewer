import { createPortablePreset, parsePortablePreset } from './presetFormat.js'

const databaseName = 'UAVLogViewer'
const storeName = 'settings'
const directoryKey = 'sharedPresetDirectory'

const isPackagedWindowsApp = () => Boolean(window.__APP_CONFIG__ && window.__APP_CONFIG__.WINDOWS_EXE)

const nativeFileUrl = relativePath => `/api/presets/file?path=${encodeURIComponent(relativePath)}`

const nativeFileHandle = relativePath => ({
    kind: 'file',
    name: relativePath.split('/').pop(),
    async getFile () {
        const response = await fetch(nativeFileUrl(relativePath), { cache: 'no-store' })
        if (!response.ok) throw new Error(`Could not read preset file (${response.status}).`)
        return { text: () => response.text() }
    },
    async createWritable () {
        let contents = ''
        return {
            async write (value) { contents = value },
            async close () {
                const response = await fetch(nativeFileUrl(relativePath), { method: 'PUT', body: contents })
                if (!response.ok) throw new Error(`Could not write preset file (${response.status}).`)
            }
        }
    }
})

const nativeDirectoryHandle = (prefix = '') => ({
    kind: 'directory',
    name: prefix || (window.__APP_CONFIG__.PRESET_FOLDER_NAME || 'presets'),
    async queryPermission () { return 'granted' },
    async requestPermission () { return 'granted' },
    async * values () {
        if (prefix) return
        const response = await fetch('/api/presets', { cache: 'no-store' })
        if (!response.ok) throw new Error(`Could not list preset files (${response.status}).`)
        for (const filename of await response.json()) yield nativeFileHandle(filename)
    },
    async getFileHandle (filename, options = {}) {
        const relativePath = prefix ? `${prefix}/${filename}` : filename
        if (options.create) return nativeFileHandle(relativePath)
        const response = await fetch(nativeFileUrl(relativePath), { method: 'HEAD', cache: 'no-store' })
        if (!response.ok) {
            const error = new Error(`Preset file does not exist (${response.status}).`)
            error.name = 'NotFoundError'
            throw error
        }
        return nativeFileHandle(relativePath)
    },
    async getDirectoryHandle (name) {
        if (prefix || name !== 'backups') throw new Error('Only the preset backup folder is available.')
        return nativeDirectoryHandle(name)
    },
    async removeEntry (filename) {
        const relativePath = prefix ? `${prefix}/${filename}` : filename
        const response = await fetch(nativeFileUrl(relativePath), { method: 'DELETE' })
        if (!response.ok && response.status !== 404) {
            throw new Error(`Could not delete preset file (${response.status}).`)
        }
    }
})

const request = value => new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result)
    value.onerror = () => reject(value.error)
})

const openDatabase = () => new Promise((resolve, reject) => {
    const database = indexedDB.open(databaseName, 1)
    database.onupgradeneeded = () => database.result.createObjectStore(storeName)
    database.onsuccess = () => resolve(database.result)
    database.onerror = () => reject(database.error)
})

const getStoredDirectory = async () => {
    const database = await openDatabase()
    const transaction = database.transaction(storeName, 'readonly')
    return request(transaction.objectStore(storeName).get(directoryKey))
}

const getDirectory = async () => {
    const storedDirectory = await getStoredDirectory()
    if (!isPackagedWindowsApp()) return storedDirectory || null
    if (storedDirectory) {
        try {
            if (await hasPermission(storedDirectory, 'read')) return storedDirectory
        } catch (error) {
            console.warn('The remembered preset folder is unavailable; using the folder beside the EXE.', error)
        }
    }
    return nativeDirectoryHandle()
}

const setDirectory = async directory => {
    const database = await openDatabase()
    const transaction = database.transaction(storeName, 'readwrite')
    await request(transaction.objectStore(storeName).put(directory, directoryKey))
}

const hasPermission = async (directory, mode) =>
    (await directory.queryPermission({ mode })) === 'granted'

const filenameFor = name => `${name.replace(/[\\/:*?"<>|]/g, '_')}.uavlog-preset.json`

const backupFilenameFor = name => {
    const now = new Date()
    const timestamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0')
    ].join('')
    return `${timestamp}-${filenameFor(name)}`
}

const writeFile = async (handle, contents) => {
    const writable = await handle.createWritable()
    await writable.write(contents)
    await writable.close()
}

const getBackupHandle = async (directory, filename) => {
    let candidate = filename
    let suffix = 2
    while (true) {
        try {
            await directory.getFileHandle(candidate)
            candidate = filename.replace('.uavlog-preset.json', `-${suffix}.uavlog-preset.json`)
            suffix += 1
        } catch (error) {
            return directory.getFileHandle(candidate, { create: true })
        }
    }
}

export const supportsSharedPresets = () => isPackagedWindowsApp() || 'showDirectoryPicker' in window

export const selectSharedPresetDirectory = async () => {
    if (!('showDirectoryPicker' in window)) {
        if (isPackagedWindowsApp()) return nativeDirectoryHandle()
        throw new Error('Shared preset folders require Chrome or Edge on desktop.')
    }
    const directory = await window.showDirectoryPicker({ mode: 'readwrite' })
    if (!await hasPermission(directory, 'readwrite')) {
        const permission = await directory.requestPermission({ mode: 'readwrite' })
        if (permission !== 'granted') throw new Error('Read and write permission is required for the preset folder.')
    }
    await setDirectory(directory)
    return directory
}

export const loadSharedPresets = async () => {
    const directory = await getDirectory()
    if (!directory) {
        return { directory: null, presets: {}, yAxisRanges: {}, yAxisLabels: {}, plotCounts: {}, permission: false }
    }
    if (!await hasPermission(directory, 'read')) {
        return { directory, presets: {}, yAxisRanges: {}, yAxisLabels: {}, plotCounts: {}, permission: false }
    }

    const presets = {}
    const yAxisRanges = {}
    const yAxisLabels = {}
    const plotCounts = {}
    for await (const handle of directory.values()) {
        if (handle.kind !== 'file' || !handle.name.endsWith('.uavlog-preset.json')) continue
        try {
            const preset = parsePortablePreset(await (await handle.getFile()).text())
            presets[preset.name] = preset.fields
            yAxisRanges[preset.name] = preset.yAxisRanges
            yAxisLabels[preset.name] = preset.yAxisLabels
            plotCounts[preset.name] = preset.plotCount
        } catch (error) {
            console.warn(`Skipping invalid shared preset ${handle.name}:`, error)
        }
    }
    return { directory, presets, yAxisRanges, yAxisLabels, plotCounts, permission: true }
}

export const saveSharedPreset = async (
    directory, name, expressions, overwrite = false, yAxisRanges = {}, yAxisLabels = {}, plotCount = 1
) => {
    if (!directory || !await hasPermission(directory, 'readwrite')) {
        throw new Error('The shared preset folder is no longer available. Choose it again in Plot Setup.')
    }
    const filename = filenameFor(name)
    let exists = true
    try {
        await directory.getFileHandle(filename)
    } catch (error) {
        exists = false
    }
    if (exists && !overwrite) return { exists: true }

    if (exists) {
        const existingHandle = await directory.getFileHandle(filename)
        const backups = await directory.getDirectoryHandle('backups', { create: true })
        const backupHandle = await getBackupHandle(backups, backupFilenameFor(name))
        await writeFile(backupHandle, await (await existingHandle.getFile()).text())
    }

    const fileHandle = await directory.getFileHandle(filename, { create: true })
    await writeFile(fileHandle, JSON.stringify(
        createPortablePreset(name, expressions, yAxisRanges, yAxisLabels, plotCount), null, 2
    ) + '\n')
    return { exists: false }
}

export const deleteSharedPreset = async name => {
    const directory = await getDirectory()
    if (!directory) return { deleted: false, available: false }
    if (!await hasPermission(directory, 'readwrite')) {
        throw new Error('The shared preset folder is no longer available. Choose it again in Plot Setup.')
    }

    const filename = filenameFor(name)
    try {
        await directory.getFileHandle(filename)
    } catch (error) {
        return { deleted: false, available: true }
    }
    await directory.removeEntry(filename)
    return { deleted: true, available: true }
}
