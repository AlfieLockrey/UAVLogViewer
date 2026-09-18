import { createPortablePreset, parsePortablePreset } from '@/tools/presetFormat.js'

describe('portable presets', () => {
    const schemaVersionKey = 'schema_version'
    const seriesNameKey = 'series_name'
    const legacyAxisLabelKey = 'axis_label'
    const visibleKey = 'visible'
    const expressions = [{
        name: '(GPS[0].Spd * 3.6) / (BAT[0].Volt * BAT[0].Curr / 1000)',
        axis: 0,
        color: '#ff0000',
        function: 1,
        seriesName: 'Efficiency',
        opacity: 0.5,
        lineStyle: 'dash',
        visible: false
    }]

    it('round-trips independent series names, axis labels, and limits', () => {
        const result = parsePortablePreset(JSON.stringify(createPortablePreset('Attitude', expressions, {
            0: [0, 100]
        }, {
            0: 'Efficiency (km/kWh)'
        })))

        expect(result).toEqual({
            name: 'Attitude',
            fields: [[
                '(GPS[0].Spd * 3.6) / (BAT[0].Volt * BAT[0].Curr / 1000)',
                0,
                '#ff0000',
                1,
                'Efficiency',
                0.5,
                'dash',
                undefined,
                false
            ]],
            yAxisRanges: { 0: [0, 100] },
            yAxisLabels: { 0: 'Efficiency (km/kWh)' }
        })
        expect(createPortablePreset('Attitude', [{ ...expressions[0], isolated: true }]))
            .not.toHaveProperty('plots.0.traces.0.isolated')
    })

    it('imports version 1 labels as series names only', () => {
        const result = parsePortablePreset(JSON.stringify({
            [schemaVersionKey]: 1,
            name: 'Legacy',
            plots: [{ traces: [{ expression: 'ATT.Roll', axis: 0, [legacyAxisLabelKey]: 'Roll angle' }] }]
        }))

        expect(result.fields).toEqual([['ATT.Roll', 0, undefined, 1, 'Roll angle', 1, 'solid', undefined, true]])
        expect(result.yAxisRanges).toEqual({})
        expect(result.yAxisLabels).toEqual({})
    })

    it('rejects a non-string series name', () => {
        expect(() => parsePortablePreset(JSON.stringify({
            [schemaVersionKey]: 2,
            name: 'Invalid',
            plots: [{ traces: [{ expression: 'ATT.Roll', axis: 0, [seriesNameKey]: 1 }] }]
        }))).toThrow('invalid series name')
    })

    it('rejects a non-boolean visibility setting', () => {
        expect(() => parsePortablePreset(JSON.stringify({
            [schemaVersionKey]: 2,
            name: 'Invalid',
            plots: [{ traces: [{ expression: 'ATT.Roll', axis: 0, [visibleKey]: 'false' }] }]
        }))).toThrow('invalid visibility setting')
    })

    it('rejects unversioned preset data', () => {
        expect(() => parsePortablePreset('{"name":"Old"}')).toThrow('Unsupported preset schema version')
    })
})
