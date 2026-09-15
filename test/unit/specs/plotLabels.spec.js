import { getAxisTitle, getTraceLabel } from '@/tools/plotLabels.js'

describe('plot labels', () => {
    const efficiency = '(GPS[0].Spd * 3.6) / (BAT[0].Volt * BAT[0].Curr / 1000)'

    it('uses an axis label for the trace legend', () => {
        expect(getTraceLabel({ name: efficiency, axisLabel: 'Efficiency (km/kWh)' }))
            .toBe('Efficiency (km/kWh)')
    })

    it('uses the first non-empty axis label as the shared axis title', () => {
        const fields = [
            { name: 'GPS[0].Spd', axis: 0, axisLabel: 'Speed (km/h)' },
            { name: 'GPS[1].Spd', axis: 0, axisLabel: 'Secondary speed' }
        ]

        expect(getAxisTitle(fields, 0)).toBe('Speed (km/h)')
        expect(getTraceLabel(fields[1])).toBe('Secondary speed')
    })

    it('uses expression names when an axis has no non-empty labels', () => {
        const fields = [
            { name: 'ATT.Roll', axis: 1, axisLabel: '   ' },
            { name: 'ATT.Pitch', axis: 1, axisLabel: '' }
        ]

        expect(getAxisTitle(fields, 1)).toBe('ATT.Roll, ATT.Pitch')
        expect(getTraceLabel(fields[0])).toBe('ATT.Roll')
    })
})
