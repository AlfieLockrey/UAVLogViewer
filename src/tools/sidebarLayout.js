export const sidebarWidthStorageKey = 'uavLogViewer.sidebarWidthPx'

export const isSidebarOverlay = viewportWidth => Number(viewportWidth) < 992

export const getDefaultSidebarWidth = viewportWidth => {
    const width = Math.max(Number(viewportWidth) || 0, 0)
    if (width < 992) return width * 0.5
    if (width < 1440) return width * 0.47
    if (width <= 2000) return width * 0.4
    return width * 0.32
}

export const getSidebarWidthBounds = viewportWidth => {
    const width = Math.max(Number(viewportWidth) || 0, 0)
    if (isSidebarOverlay(width)) {
        const maximum = Math.max(width - 16, 0)
        return {
            minimum: Math.min(180, maximum),
            maximum
        }
    }
    const maximum = Math.max(width - 480, 0)
    return {
        minimum: Math.min(560, maximum),
        maximum
    }
}

export const clampSidebarWidth = (requestedWidth, viewportWidth) => {
    const bounds = getSidebarWidthBounds(viewportWidth)
    const requested = Number(requestedWidth)
    const width = Number.isFinite(requested) ? requested : getDefaultSidebarWidth(viewportWidth)
    return Math.min(Math.max(width, bounds.minimum), bounds.maximum)
}

export const getSidebarWidth = (viewportWidth, requestedWidth = null) => requestedWidth === null
    ? getDefaultSidebarWidth(viewportWidth)
    : clampSidebarWidth(requestedWidth, viewportWidth)

export const parseStoredSidebarWidth = value => {
    if (value === null || value === '') return null
    const width = Number(value)
    return Number.isFinite(width) && width > 0 ? width : null
}
