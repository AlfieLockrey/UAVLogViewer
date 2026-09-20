import {
    getAxesForPanel, getHorizontalAxisLayout, getLayoutXAxis, getLocalAxis, getPanelDomains, getPanelForAxis,
    getPanelHorizontalAxisLayout, getTraceXAxis, normalisePlotCount
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

    it('reserves horizontal space only for axes that are in use', () => {
        const paperWidth = 1000 - 140
        const allAxes = getHorizontalAxisLayout(1000, 1)
        const sparseAxes = getHorizontalAxisLayout(1000, 1, [0, 2, 5])
        const noAxes = getHorizontalAxisLayout(1000, 1, [])

        expect(sparseAxes.domain[0]).toBeLessThan(allAxes.domain[0])
        expect(sparseAxes.domain[1]).toBeGreaterThan(allAxes.domain[1])
        expect((sparseAxes.positions[2] - sparseAxes.positions[0]) * paperWidth).toBeCloseTo(64)
        expect(sparseAxes.positions[1]).toBeUndefined()
        expect(noAxes.domain).toEqual([0, 1])
    })

    it('can compact a supplied local axis set', () => {
        const paperWidth = 1000 - 140
        const horizontal = getHorizontalAxisLayout(1000, 2, [0, 2])

        expect((horizontal.positions[2] - horizontal.positions[0]) * paperWidth).toBeCloseTo(64)
        expect(horizontal.positions[1]).toBeUndefined()
    })

    it('reserves identical axis space for every graph in multi-graph mode', () => {
        const firstPanel = getPanelHorizontalAxisLayout(1000, 3, [0, 1])
        const secondPanel = getPanelHorizontalAxisLayout(1000, 3, [0])
        const emptyPanel = getPanelHorizontalAxisLayout(1000, 3, [])

        expect(secondPanel).toEqual(firstPanel)
        expect(emptyPanel).toEqual(firstPanel)
        expect(firstPanel.positions[0]).toBeDefined()
        expect(firstPanel.positions[1]).toBeDefined()
    })

    it('still reclaims unused axis space in single-graph mode', () => {
        const sparse = getPanelHorizontalAxisLayout(1000, 1, [0, 2])
        const full = getPanelHorizontalAxisLayout(1000, 1, [0, 1, 2, 3, 4, 5])

        expect(sparse.domain[0]).toBeLessThan(full.domain[0])
        expect(sparse.positions[1]).toBeUndefined()
    })
})
