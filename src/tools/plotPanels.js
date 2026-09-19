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

export const getHorizontalAxisLayout = (containerWidth, count) => {
    const panelCount = normalisePlotCount(count)
    const axesPerPanel = 6 / panelCount
    const leftAxisCount = Math.min(axesPerPanel, 3)
    const rightAxisCount = Math.max(axesPerPanel - 3, 0)
    const paperWidth = Math.max(Number(containerWidth) - plotHorizontalMargins, 1)
    const leftPixels = axisPlotGapPixels + (leftAxisCount - 1) * axisSpacingPixels
    const rightPixels = rightAxisCount > 0
        ? axisPlotGapPixels + (rightAxisCount - 1) * axisSpacingPixels
        : axisPlotGapPixels
    const domain = [leftPixels / paperWidth, 1 - rightPixels / paperWidth]
    const positions = []

    for (let axis = 0; axis < leftAxisCount; axis++) {
        positions.push((leftPixels - axisPlotGapPixels -
            (leftAxisCount - axis - 1) * axisSpacingPixels) / paperWidth)
    }
    for (let axis = 0; axis < rightAxisCount; axis++) {
        positions.push((paperWidth - rightPixels + axisPlotGapPixels + axis * axisSpacingPixels) / paperWidth)
    }
    return { domain, positions }
}
