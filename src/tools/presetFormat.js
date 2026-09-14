export const PRESET_SCHEMA_VERSION = 1
const schemaKey = 'schema_version'

const isNonEmptyString = value => typeof value === 'string' && value.trim().length > 0

const normaliseTrace = (trace, index) => {
    if (!trace || !isNonEmptyString(trace.expression)) {
        throw new Error(`Trace ${index + 1} must contain an expression.`)
    }
    const axis = Number(trace.axis)
    if (!Number.isInteger(axis) || axis < 0) {
        throw new Error(`Trace ${index + 1} has an invalid axis.`)
    }
    return {
        expression: trace.expression,
        axis,
        color: typeof trace.color === 'string' ? trace.color : undefined,
        function: typeof trace.function === 'number' ? trace.function : 1
    }
}

export const createPortablePreset = (name, expressions) => ({
    [schemaKey]: PRESET_SCHEMA_VERSION,
    name,
    plots: [{
        title: name,
        traces: expressions.map(field => ({
            expression: field.name,
            axis: field.axis,
            color: field.color,
            function: field.function
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
        fields: traces.map(trace => [trace.expression, trace.axis, trace.color, trace.function])
    }
}
