export const PRESET_SCHEMA_VERSION = 1
const schemaKey = 'schema_version'
const axisLabelKey = 'axis_label'
const opacityKey = 'opacity'
const lineStyleKey = 'line_style'
const visibleKey = 'visible'
const yAxesKey = 'y_axes'
const lineStyles = ['solid', 'dash', 'dot', 'dashdot']

const isNonEmptyString = value => typeof value === 'string' && value.trim().length > 0

const normaliseTrace = (trace, index) => {
    if (!trace || !isNonEmptyString(trace.expression)) {
        throw new Error(`Trace ${index + 1} must contain an expression.`)
    }
    const axis = Number(trace.axis)
    if (!Number.isInteger(axis) || axis < 0) {
        throw new Error(`Trace ${index + 1} has an invalid axis.`)
    }
    if (trace[axisLabelKey] !== undefined && typeof trace[axisLabelKey] !== 'string') {
        throw new Error(`Trace ${index + 1} has an invalid axis label.`)
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
        axisLabel: trace[axisLabelKey] || '',
        opacity: trace[opacityKey] === undefined ? 1 : trace[opacityKey],
        lineStyle: trace[lineStyleKey] || 'solid',
        visible: trace[visibleKey] !== false
    }
}

const normaliseYAxisRanges = ranges => Object.entries(ranges || {}).map(([axis, range]) => ({
    axis: Number(axis),
    min: range[0],
    max: range[1]
}))

const parseYAxisRanges = axes => {
    if (axes === undefined) return {}
    if (!Array.isArray(axes)) throw new Error('The preset has invalid y-axis limits.')
    const ranges = {}
    for (const axis of axes) {
        if (!axis || !Number.isInteger(axis.axis) || axis.axis < 0 ||
            !Number.isFinite(axis.min) || !Number.isFinite(axis.max) || axis.min >= axis.max) {
            throw new Error('The preset has invalid y-axis limits.')
        }
        ranges[axis.axis] = [axis.min, axis.max]
    }
    return ranges
}

export const createPortablePreset = (name, expressions, yAxisRanges = {}) => ({
    [schemaKey]: PRESET_SCHEMA_VERSION,
    name,
    plots: [{
        title: name,
        [yAxesKey]: normaliseYAxisRanges(yAxisRanges),
        traces: expressions.map(field => ({
            expression: field.name,
            axis: field.axis,
            color: field.color,
            function: field.function,
            [axisLabelKey]: typeof field.axisLabel === 'string' ? field.axisLabel : '',
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
    if (!preset || preset[schemaKey] !== PRESET_SCHEMA_VERSION) {
        throw new Error(`Unsupported preset schema version. Expected ${PRESET_SCHEMA_VERSION}.`)
    }
    if (!isNonEmptyString(preset.name)) {
        throw new Error('The preset must have a name.')
    }
    if (!Array.isArray(preset.plots) || preset.plots.length !== 1 || !Array.isArray(preset.plots[0].traces)) {
        throw new Error('This version supports one plot containing a traces array.')
    }
    const traces = preset.plots[0].traces.map(normaliseTrace)
    if (traces.length === 0) {
        throw new Error('The preset must contain at least one trace.')
    }
    return {
        name: preset.name.trim(),
        fields: traces.map(trace => [trace.expression, trace.axis, trace.color, trace.function,
            trace.axisLabel, trace.opacity, trace.lineStyle, undefined, trace.visible]),
        yAxisRanges: parseYAxisRanges(preset.plots[0][yAxesKey])
    }
}
