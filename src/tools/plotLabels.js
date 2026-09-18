const nonEmptyLabel = value => typeof value === 'string' ? value.trim() : ''

export const getTraceLabel = field => nonEmptyLabel(field.seriesName) || field.name

export const getAxisTitle = (fields, axis, axisLabels = {}) => {
    const axisLabel = nonEmptyLabel(axisLabels[axis])
    if (axisLabel) return axisLabel
    const axisFields = fields.filter(field => field.axis === axis)
    return axisFields.map(field => field.name).join(', ')
}
