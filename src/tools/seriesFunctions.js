const functionPattern = /\b(maxseries|minseries)\s*\(/

export const findSeriesFunctionCall = expression => {
    const match = functionPattern.exec(expression)
    if (!match) return null

    const openIndex = match.index + match[0].lastIndexOf('(')
    let depth = 1
    let quote = null
    let escaped = false
    for (let index = openIndex + 1; index < expression.length; index++) {
        const character = expression[index]
        if (quote !== null) {
            if (escaped) escaped = false
            else if (character === '\\') escaped = true
            else if (character === quote) quote = null
            continue
        }
        if (character === '"' || character === "'") {
            quote = character
        } else if (character === '(') {
            depth += 1
        } else if (character === ')') {
            depth -= 1
            if (depth === 0) {
                return {
                    name: match[1],
                    start: match.index,
                    end: index + 1,
                    argument: expression.slice(openIndex + 1, index).trim()
                }
            }
        }
    }
    throw new Error(`${match[1]} is missing a closing parenthesis.`)
}

export const getSeriesAggregate = (name, values) => {
    let result = name === 'maxseries' ? -Infinity : Infinity
    let foundValue = false
    for (const value of values || []) {
        if (!Number.isFinite(value)) continue
        foundValue = true
        result = name === 'maxseries' ? Math.max(result, value) : Math.min(result, value)
    }
    if (!foundValue) throw new Error(`${name} requires at least one finite value.`)
    return result
}
