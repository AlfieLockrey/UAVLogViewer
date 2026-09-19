import {
    getAxesForPanel, getHorizontalAxisLayout, getLayoutXAxis, getLocalAxis, getPanelDomains, getPanelForAxis,
    getTraceXAxis, normalisePlotCount
} from '@/tools/plotPanels.js'

describe('stacked plot panels', () => {
    it('keeps one panel as the original six-axis plot', () => {
        expect(getAxesForPanel(0, 1)).toEqual([0, 1, 2, 3, 4, 5])
        expect([0, 1, 2, 3, 4, 5].map(axis => getPanelForAxis(axis, 1))).toEqual([0, 0, 0, 0, 0, 0])
    })

    it('divides axes into two groups of three', () => {
        expect(getAxesForPanel(0, 2)).toEqual([0, 1, 2])
        expect(getAxesForPanel(1, 2)).toEqual([3, 4, 5])
        expect([0, 1, 2, 3, 4, 5].map(axis => getPanelForAxis(axis, 2))).toEqual([0, 0, 0, 1, 1, 1])
        expect([3, 4, 5].map(axis => getLocalAxis(axis, 2))).toEqual([0, 1, 2])
    })

    it('divides axes into three groups of two', () => {
        expect(getAxesForPanel(0, 3)).toEqual([0, 1])
        expect(getAxesForPanel(1, 3)).toEqual([2, 3])
        expect(getAxesForPanel(2, 3)).toEqual([4, 5])
        expect([0, 1, 2, 3, 4, 5].map(axis => getPanelForAxis(axis, 3))).toEqual([0, 0, 1, 1, 2, 2])
        expect([2, 3, 4, 5].map(axis => getLocalAxis(axis, 3))).toEqual([0, 1, 0, 1])
        expect([0, 1, 2].map(getTraceXAxis)).toEqual(['x', 'x2', 'x3'])
        expect([0, 1, 2].map(getLayoutXAxis)).toEqual(['xaxis', 'xaxis2', 'xaxis3'])
    })

    it('creates separate vertical domains and defaults invalid settings to one plot', () => {
        const domains = getPanelDomains(3)
        expect(domains).toHaveLength(3)
        expect(domains[0][0]).toBeGreaterThan(domains[1][1])
        expect(domains[1][0]).toBeGreaterThan(domains[2][1])
        expect(normalisePlotCount(4)).toBe(1)
    })

    it('keeps horizontal axes a fixed pixel distance apart', () => {
        const narrow = getHorizontalAxisLayout(800, 1)
        const wide = getHorizontalAxisLayout(1600, 1)
        const narrowPaperWidth = 800 - 140
        const widePaperWidth = 1600 - 140

        expect((narrow.positions[1] - narrow.positions[0]) * narrowPaperWidth).toBeCloseTo(64)
        expect((wide.positions[1] - wide.positions[0]) * widePaperWidth).toBeCloseTo(64)
        expect((narrow.positions[4] - narrow.positions[3]) * narrowPaperWidth).toBeCloseTo(64)
        expect(narrow.domain[0]).toBeGreaterThan(wide.domain[0])
    })
})
