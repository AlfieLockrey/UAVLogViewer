import { formatPlotStatistics, getPlotStatistics } from '@/tools/plotStatistics.js'

describe('plot statistics', () => {
    it('uses finite values inside the active time selection', () => {
        const statistics = getPlotStatistics([0, 1000, 2000, 3000], [1, 2, NaN, 5], [500, 2500])
        expect(statistics).toEqual({ min: 2, max: 2, mean: 2 })
        expect(formatPlotStatistics(statistics)).toBe('Min: 2.00 Max: 2.00 Mean: 2.00')
    })

    it('returns an em dash when the selection has no finite samples', () => {
        expect(getPlotStatistics([0, 1000], [NaN, Infinity], [0, 2000])).toBeNull()
        expect(formatPlotStatistics(null)).toBe('\u2014')
    })
})
