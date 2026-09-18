import {
    formatPlotTime, getElapsedOrigin, getPlotHoverTemplate, getPlotHoverValues, getPlotTimeAxis
} from '@/tools/plotTimeAxis.js'

describe('plot time axis', () => {
    it('uses the first armed event as the elapsed-time origin', () => {
        expect(getElapsedOrigin([[100, false], [2500, true], [5000, 'Armed']], [])).toBe(2500)
    })

    it('uses the earliest active trace sample when there is no armed event', () => {
        const traces = [{ x: [4000, 5000] }, { x: [1500, 3000] }]
        expect(getElapsedOrigin([], traces)).toBe(1500)
    })

    it('formats elapsed time in seconds with millisecond precision', () => {
        expect(formatPlotTime(3250, { mode: 'elapsed', elapsedOrigin: 2000 })).toBe('1.250')
    })

    it('uses compact elapsed seconds in trace tooltips', () => {
        const context = { mode: 'elapsed', elapsedOrigin: 2000 }
        expect([...getPlotHoverValues([2000, 3250], context)]).toEqual([0, 1.25])
        expect(getPlotHoverTemplate(context)).toContain('%{customdata}')
    })

    it('formats world time in the configured timezone', () => {
        const context = {
            mode: 'world',
            worldStart: new Date('2024-06-01T12:00:00.000Z'),
            worldStartMs: 1000,
            worldTimeZone: 'Europe/London'
        }
        expect(formatPlotTime(2000, context)).toBe('13:00:01')
    })

    it('keeps raw milliseconds as tick values while providing formatted labels', () => {
        const axis = getPlotTimeAxis([2000, 8000], { mode: 'elapsed', elapsedOrigin: 2000 }, [0.1, 0.9])
        expect(axis.tickvals).toEqual([2000, 3000, 4000, 5000, 6000, 7000, 8000])
        expect(axis.ticktext).toEqual(['0.000', '1.000', '2.000', '3.000', '4.000', '5.000', '6.000'])
    })

    it('adds the selection window only when requested', () => {
        const context = { mode: 'elapsed', elapsedOrigin: 0 }
        expect(getPlotTimeAxis([0, 1000], context, [0.1, 0.9], false).rangeslider).toBeUndefined()
        expect(getPlotTimeAxis([0, 1000], context, [0.1, 0.9], true).rangeslider).toEqual({})
    })
})
