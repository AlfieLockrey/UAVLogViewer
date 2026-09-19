export const getPlotStatistics = (xValues, yValues, range) => {
    if (!range || !Number.isFinite(range[0]) || !Number.isFinite(range[1])) return null

    const length = Math.min(xValues.length, yValues.length)
    let count = 0
    let sum = 0
    let min = Infinity
    let max = -Infinity

    for (let index = 0; index < length; index++) {
        const x = xValues[index]
        const y = yValues[index]
        if (x > range[0] && x < range[1] && Number.isFinite(y)) {
            count += 1
            sum += y
            min = Math.min(min, y)
            max = Math.max(max, y)
        }
    }

    return count === 0 ? null : { min, max, mean: sum / count }
}

export const formatStatisticValue = value => {
    if (!Number.isFinite(value)) return '\u2014'
    const formatted = value.toPrecision(6)
    const mantissa = formatted.split(/[eE]/)[0]
    const decimals = mantissa.includes('.') ? mantissa.split('.')[1].length : 0
    return decimals > 6 ? value.toExponential(5) : formatted
}

export const formatPlotStatistics = statistics => statistics
    ? `Min: ${formatStatisticValue(statistics.min)} Max: ${formatStatisticValue(statistics.max)} ` +
        `Mean: ${formatStatisticValue(statistics.mean)}`
    : '\u2014'
