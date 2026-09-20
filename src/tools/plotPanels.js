const panelGap = 0.04
const axisSpacingPixels = 64
const axisPlotGapPixels = 8
const plotHorizontalMargins = 140

export const normalisePlotCount = count => [1, 2, 3].includes(Number(count)) ? Number(count) : 1

export const getPanelForAxis = (axis, count) => Math.floor(axis / (6 / normalisePlotCount(count)))

export const getAxesForPanel = (panel, count) => {
    const axesPerPanel = 6 / normalisePlotCount(count)
    const firstAxis = panel * axesPerPanel
    return Array.from({ length: axesPerPanel }, (_, index) => firstAxis + index)
}

export const getLocalAxis = (axis, count) => axis % (6 / normalisePlotCount(count))

export const getPanelDomains = count => {
    const panelCount = normalisePlotCount(count)
    const height = (1 - panelGap * (panelCount - 1)) / panelCount
    return Array.from({ length: panelCount }, (_, panel) => {
        const upper = 1 - panel * (height + panelGap)
        return [upper - height, upper]
    })
}

export const getTraceXAxis = panel => panel === 0 ? 'x' : `x${panel + 1}`

export const getLayoutXAxis = panel => panel === 0 ? 'xaxis' : `xaxis${panel + 1}`

export const getLayoutYAxis = axis => axis === 0 ? 'yaxis' : `yaxis${axis + 1}`

export const getHorizontalAxisLayout = (containerWidth, count, activeAxes = null) => {
    const panelCount = normalisePlotCount(count)
    const axesPerPanel = 6 / panelCount
    const axes = activeAxes === null
        ? Array.from({ length: axesPerPanel }, (_, axis) => axis)
        : [...new Set(activeAxes)].filter(axis => Number.isInteger(axis) && axis >= 0 && axis < axesPerPanel).sort()
    const leftAxes = axes.filter(axis => axis < 3)
    const rightAxes = axes.filter(axis => axis >= 3)
    const paperWidth = Math.max(Number(containerWidth) - plotHorizontalMargins, 1)
    const leftPixels = leftAxes.length > 0
        ? axisPlotGapPixels + (leftAxes.length - 1) * axisSpacingPixels
        : 0
    const rightPixels = rightAxes.length > 0
        ? axisPlotGapPixels + (rightAxes.length - 1) * axisSpacingPixels
        : 0
    const domain = [leftPixels / paperWidth, 1 - rightPixels / paperWidth]
    const positions = new Array(axesPerPanel)

    leftAxes.forEach((axis, index) => {
        positions[axis] = index * axisSpacingPixels / paperWidth
    })
    rightAxes.forEach((axis, index) => {
        positions[axis] = (paperWidth - (rightAxes.length - index - 1) * axisSpacingPixels) / paperWidth
    })
    return { domain, positions }
}

export const getPanelHorizontalAxisLayout = (containerWidth, count, activeAxes = []) =>
    getHorizontalAxisLayout(
        containerWidth,
        count,
        normalisePlotCount(count) > 1 ? null : activeAxes
    )
