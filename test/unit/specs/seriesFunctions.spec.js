import { findSeriesFunctionCall, getSeriesAggregate } from '@/tools/seriesFunctions.js'

describe('series expression functions', () => {
    it('finds a series function with a nested expression', () => {
        expect(findSeriesFunctionCall('2 * maxseries(max(GPS[0].Spd, 3))')).toEqual({
            name: 'maxseries',
            start: 4,
            end: 33,
            argument: 'max(GPS[0].Spd, 3)'
        })
    })

    it('calculates finite minimum and maximum values', () => {
        expect(getSeriesAggregate('maxseries', [1, NaN, 22.3, null])).toBe(22.3)
        expect(getSeriesAggregate('minseries', [1, -4, Infinity, 2])).toBe(-4)
    })

    it('rejects a series without finite values', () => {
        expect(() => getSeriesAggregate('maxseries', [NaN, Infinity])).toThrow('at least one finite value')
    })
})
