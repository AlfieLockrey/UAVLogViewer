import { getAxisTitle, getTraceLabel } from '@/tools/plotLabels.js'

describe('plot labels', () => {
    it('uses a series name for the trace label', () => {
        expect(getTraceLabel({ name: 'GPS.Spd', seriesName: 'Ground speed' })).toBe('Ground speed')
    })

    it('uses the expression when a series name is blank', () => {
        expect(getTraceLabel({ name: 'ATT.Roll', seriesName: '   ' })).toBe('ATT.Roll')
    })

    it('uses the per-axis label independently from series names', () => {
        const fields = [
            { name: 'GPS[0].Spd', axis: 0, seriesName: 'Primary' },
            { name: 'GPS[1].Spd', axis: 0, seriesName: 'Secondary' }
        ]

        expect(getAxisTitle(fields, 0, { 0: 'Speed (km/h)' })).toBe('Speed (km/h)')
        expect(getTraceLabel(fields[1])).toBe('Secondary')
    })

    it('uses expression names when an axis label is blank', () => {
        const fields = [
            { name: 'ATT.Roll', axis: 1 },
            { name: 'ATT.Pitch', axis: 1 }
        ]

        expect(getAxisTitle(fields, 1, { 1: '   ' })).toBe('ATT.Roll, ATT.Pitch')
    })
})
