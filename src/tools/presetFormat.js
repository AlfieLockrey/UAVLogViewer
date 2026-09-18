export const PRESET_SCHEMA_VERSION = 2
const schemaKey = 'schema_version'
const legacyAxisLabelKey = 'axis_label'
const seriesNameKey = 'series_name'
const opacityKey = 'opacity'
const lineStyleKey = 'line_style'
const visibleKey = 'visible'
const yAxesKey = 'y_axes'
const axisLabelKey = 'label'
const lineStyles = ['solid', 'dash', 'dot', 'dashdot']

const isNonEmptyString = value => typeof value === 'string' && value.trim().length > 0

const normaliseTrace = (trace, index, schemaVersion) => {
    if (!trace || !isNonEmptyString(trace.expression)) {
        throw new Error(`Trace ${index + 1} must contain an expression.`)
    }
    const axis = Number(trace.axis)
    if (!Number.isInteger(axis) || axis < 0) {
        throw new Error(`Trace ${index + 1} has an invalid axis.`)
    }
    const labelKey = schemaVersion === 1 ? legacyAxisLabelKey : seriesNameKey
    if (trace[labelKey] !== undefined && typeof trace[labelKey] !== 'string') {
        throw new Error(`Trace ${index + 1} has an invalid series name.`)
    }
    if (trace[opacityKey] !== undefined &&
        (typeof trace[opacityKey] !== 'number' || trace[opacityKey] < 0 || trace[opacityKey] > 1)) {
        throw new Error(`Trace ${index + 1} has an invalid opacity.`)
    }
    if (trace[lineStyleKey] !== undefined && !lineStyles.includes(trace[lineStyleKey])) {
        throw new Error(`Trace ${index + 1} has an invalid line style.`)
    }
    if (trace[visibleKey] !== undefined && typeof trace[visibleKey] !== 'boolean') {
        throw new Error(`Trace ${index + 1} has an invalid visibility setting.`)
    }
    return {
        expression: trace.expression,
        axis,
        color: typeof trace.color === 'string' ? trace.color : undefined,
        function: typeof trace.function === 'number' ? trace.function : 1,
        seriesName: trace[labelKey] || '',
        opacity: trace[opacityKey] === undefined ? 1 : trace[opacityKey],
        lineStyle: trace[lineStyleKey] || 'solid',
        visible: trace[visibleKey] !== false
    }
}

const normaliseYAxes = (ranges, labels) => {
    const axes = new Set([...Object.keys(ranges || {}), ...Object.keys(labels || {})])
    return [...axes].map(axisKey => {
        const axis = Number(axisKey)
        const range = ranges[axis]
        const label = labels[axis]
        const settings = { axis }
        if (range && Number.isFinite(range[0]) && Number.isFinite(range[1]) && range[0] < range[1]) {
            settings.min = range[0]
            settings.max = range[1]
        }
        if (isNonEmptyString(label)) settings[axisLabelKey] = label.trim()
        return settings
    }).filter(settings => Number.isInteger(settings.axis) && settings.axis >= 0 &&
        (settings.min !== undefined || settings[axisLabelKey] !== undefined))
}

const parseYAxisSettings = (axes, schemaVersion) => {
    if (axes === undefined) return { ranges: {}, labels: {} }
    if (!Array.isArray(axes)) throw new Error('The preset has invalid y-axis settings.')
    const ranges = {}
    const labels = {}
    for (const axis of axes) {
        if (!axis || !Number.isInteger(axis.axis) || axis.axis < 0) {
            throw new Error('The preset has invalid y-axis settings.')
        }
        const hasRange = axis.min !== undefined || axis.max !== undefined
        if (hasRange && (!Number.isFinite(axis.min) || !Number.isFinite(axis.max) || axis.min >= axis.max)) {
            throw new Error('The preset has invalid y-axis limits.')
        }
        if (schemaVersion === 1 && !hasRange) throw new Error('The preset has invalid y-axis limits.')
        if (axis[axisLabelKey] !== undefined && typeof axis[axisLabelKey] !== 'string') {
            throw new Error('The preset has an invalid y-axis label.')
        }
        if (!hasRange && !isNonEmptyString(axis[axisLabelKey])) {
            throw new Error('The preset has invalid y-axis settings.')
        }
        if (hasRange) ranges[axis.axis] = [axis.min, axis.max]
        if (isNonEmptyString(axis[axisLabelKey])) labels[axis.axis] = axis[axisLabelKey].trim()
    }
    return { ranges, labels }
}

export const createPortablePreset = (name, expressions, yAxisRanges = {}, yAxisLabels = {}) => ({
    [schemaKey]: PRESET_SCHEMA_VERSION,
    name,
    plots: [{
        title: name,
        [yAxesKey]: normaliseYAxes(yAxisRanges, yAxisLabels),
        traces: expressions.map(field => ({
            expression: field.name,
            axis: field.axis,
            color: field.color,
            function: field.function,
            [seriesNameKey]: typeof field.seriesName === 'string' ? field.seriesName : '',
            [opacityKey]: typeof field.opacity === 'number' ? field.opacity : 1,
            [lineStyleKey]: lineStyles.includes(field.lineStyle) ? field.lineStyle : 'solid',
            [visibleKey]: field.visible !== false
        }))
    }]
})

export const parsePortablePreset = contents => {
    let preset
    try {
        preset = JSON.parse(contents)
    } catch (error) {
        throw new Error('The selected file is not valid JSON.')
    }
    if (!preset || ![1, PRESET_SCHEMA_VERSION].includes(preset[schemaKey])) {
        throw new Error(`Unsupported preset schema version. Expected ${PRESET_SCHEMA_VERSION}.`)
    }
    if (!isNonEmptyString(preset.name)) {
        throw new Error('The preset must have a name.')
    }
    if (!Array.isArray(preset.plots) || preset.plots.length !== 1 || !Array.isArray(preset.plots[0].traces)) {
        throw new Error('This version supports one plot containing a traces array.')
    }
    const schemaVersion = preset[schemaKey]
    const traces = preset.plots[0].traces.map((trace, index) => normaliseTrace(trace, index, schemaVersion))
    if (traces.length === 0) {
        throw new Error('The preset must contain at least one trace.')
    }
    const yAxisSettings = parseYAxisSettings(preset.plots[0][yAxesKey], schemaVersion)
    return {
        name: preset.name.trim(),
        fields: traces.map(trace => [trace.expression, trace.axis, trace.color, trace.function,
            trace.seriesName, trace.opacity, trace.lineStyle, undefined, trace.visible]),
        yAxisRanges: yAxisSettings.ranges,
        yAxisLabels: yAxisSettings.labels
    }
}
