import { createPortablePreset, parsePortablePreset } from '@/tools/presetFormat.js'

describe('portable presets', () => {
    const schemaVersionKey = 'schema_version'
    const axisLabelKey = 'axis_label'
    const visibleKey = 'visible'
    const expressions = [{
        name: '(GPS[0].Spd * 3.6) / (BAT[0].Volt * BAT[0].Curr / 1000)',
        axis: 0,
        color: '#ff0000',
        function: 1,
        axisLabel: 'Efficiency (km/kWh)',
        opacity: 0.5,
        lineStyle: 'dash',
        visible: false
    }]

    it('round-trips expressions without changing viewer configuration', () => {
        const result = parsePortablePreset(JSON.stringify(createPortablePreset('Attitude', expressions, {
            0: [0, 100]
        })))

        expect(result).toEqual({
            name: 'Attitude',
            fields: [[
                '(GPS[0].Spd * 3.6) / (BAT[0].Volt * BAT[0].Curr / 1000)',
                0,
                '#ff0000',
                1,
                'Efficiency (km/kWh)',
                0.5,
                'dash',
                undefined,
                false
            ]],
            yAxisRanges: { 0: [0, 100] }
        })
    })

    it('imports version 1 presets without an axis label', () => {
        const result = parsePortablePreset(JSON.stringify({
            [schemaVersionKey]: 1,
            name: 'Legacy',
            plots: [{ traces: [{ expression: 'ATT.Roll', axis: 0 }] }]
        }))

        expect(result.fields).toEqual([['ATT.Roll', 0, undefined, 1, '', 1, 'solid', undefined, true]])
        expect(result.yAxisRanges).toEqual({})
    })

    it('rejects a non-string axis label', () => {
        expect(() => parsePortablePreset(JSON.stringify({
            [schemaVersionKey]: 1,
            name: 'Invalid',
            plots: [{ traces: [{ expression: 'ATT.Roll', axis: 0, [axisLabelKey]: 1 }] }]
        }))).toThrow('invalid axis label')
    })

    it('rejects a non-boolean visibility setting', () => {
        expect(() => parsePortablePreset(JSON.stringify({
            [schemaVersionKey]: 1,
            name: 'Invalid',
            plots: [{ traces: [{ expression: 'ATT.Roll', axis: 0, [visibleKey]: 'false' }] }]
        }))).toThrow('invalid visibility setting')
    })

    it('rejects unversioned preset data', () => {
        expect(() => parsePortablePreset('{"name":"Old"}')).toThrow('Unsupported preset schema version')
    })
})
