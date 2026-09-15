import { DateTime } from 'luxon'

const tickSteps = [1, 2, 5]

const isArmed = value => value === true || value === 'Armed'

export const getElapsedOrigin = (events, traces) => {
    const armed = (events || []).find(event => isArmed(event[1]))
    if (armed) return armed[0]

    const firstTimes = (traces || [])
        .map(trace => trace.x && trace.x[0])
        .filter(time => typeof time === 'number' && Number.isFinite(time))
    return firstTimes.length ? Math.min(...firstTimes) : 0
}

const tickStep = (range) => {
    const target = Math.max(range / 6, 1)
    const exponent = Math.pow(10, Math.floor(Math.log10(target)))
    return tickSteps.map(step => step * exponent).find(step => step >= target) || 10 * exponent
}

export const formatPlotTime = (time, context) => {
    if (context.mode === 'world' && context.worldStart instanceof Date && !isNaN(context.worldStart)) {
        return DateTime.fromMillis(context.worldStart.getTime() + time - context.worldStartMs)
            .setZone(context.worldTimeZone || 'utc')
            .toFormat('HH:mm:ss')
    }
    return ((time - context.elapsedOrigin) / 1000).toFixed(3)
}

export const getPlotHoverValues = (times, context) => {
    const values = new Float64Array(times.length)
    const offset = context.mode === 'world'
        ? context.worldStart.getTime() - context.worldStartMs
        : context.elapsedOrigin
    for (let index = 0; index < times.length; index++) {
        values[index] = context.mode === 'world'
            ? times[index] + offset
            : Math.round(((times[index] - offset) / 1000) * 1000) / 1000
    }
    return values
}

export const getPlotHoverTemplate = context => context.mode === 'world'
    ? '%{customdata|%H:%M:%S}<br>%{y}<extra>%{meta}</extra>'
    : '%{customdata}<br>%{y}<extra>%{meta}</extra>'

export const getPlotTimeAxis = (range, context, domain, includeRangeSlider = true) => {
    const validRange = range && range.length === 2 &&
        Number.isFinite(range[0]) && Number.isFinite(range[1]) && range[1] >= range[0]
    const safeRange = validRange ? range : [0, 1]
    const step = tickStep(safeRange[1] - safeRange[0])
    const tickvals = []
    for (let value = Math.ceil(safeRange[0] / step) * step; value <= safeRange[1]; value += step) {
        tickvals.push(value)
    }
    const axis = {
        domain,
        title: context.mode === 'world' ? 'World time' : 'Elapsed time (s)',
        tickmode: 'array'
    }
    if (validRange) {
        axis.tickvals = tickvals
        axis.ticktext = tickvals.map(time => formatPlotTime(time, context))
    }
    if (includeRangeSlider) axis.rangeslider = {}
    return axis
}
