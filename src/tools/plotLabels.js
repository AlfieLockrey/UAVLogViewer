const nonEmptyLabel = value => typeof value === 'string' ? value.trim() : ''

export const getTraceLabel = field => nonEmptyLabel(field.axisLabel) || field.name

export const getAxisTitle = (fields, axis) => {
    const axisFields = fields.filter(field => field.axis === axis)
    const labelledField = axisFields.find(field => nonEmptyLabel(field.axisLabel))
    return labelledField ? nonEmptyLabel(labelledField.axisLabel) : axisFields.map(field => field.name).join(', ')
}
