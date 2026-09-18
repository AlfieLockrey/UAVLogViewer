export const setTraceVisibility = (expressions, index, visible) => expressions.map((field, fieldIndex) => ({
    ...field,
    visible: fieldIndex === index ? visible : field.visible,
    isolated: fieldIndex === index
        ? visible && field.isolated === true
        : visible && fieldIndex !== index ? false : field.isolated === true
}))

export const isolateTrace = (expressions, index, isolated) => expressions.map((field, fieldIndex) => ({
    ...field,
    visible: isolated ? fieldIndex === index : true,
    isolated: isolated && fieldIndex === index
}))
