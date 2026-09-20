import {
    clampSidebarWidth, getDefaultSidebarWidth, getSidebarWidth, getSidebarWidthBounds, isSidebarOverlay,
    parseStoredSidebarWidth
} from '@/tools/sidebarLayout.js'

describe('resizable sidebar layout', () => {
    it('preserves the existing responsive default widths', () => {
        expect(getDefaultSidebarWidth(800)).toBe(400)
        expect(getDefaultSidebarWidth(1200)).toBe(564)
        expect(getDefaultSidebarWidth(1600)).toBe(640)
        expect(getDefaultSidebarWidth(2560)).toBe(819.2)
    })

    it('uses separate desktop and overlay bounds', () => {
        expect(isSidebarOverlay(991)).toBe(true)
        expect(isSidebarOverlay(992)).toBe(false)
        expect(getSidebarWidthBounds(800)).toEqual({ minimum: 180, maximum: 784 })
        expect(getSidebarWidthBounds(1200)).toEqual({ minimum: 560, maximum: 720 })
    })

    it('clamps a manual width while retaining the requested value separately', () => {
        const requested = 900
        expect(clampSidebarWidth(requested, 1200)).toBe(720)
        expect(getSidebarWidth(1800, requested)).toBe(900)
        expect(getSidebarWidth(1800, null)).toBe(720)
    })

    it('accepts only positive stored widths', () => {
        expect(parseStoredSidebarWidth('640')).toBe(640)
        expect(parseStoredSidebarWidth('not-a-width')).toBeNull()
        expect(parseStoredSidebarWidth('-1')).toBeNull()
    })
})
