import { createPortablePreset, parsePortablePreset } from '@/tools/presetFormat.js'

describe('portable presets', () => {
    const expressions = [{ name: 'ATT.Roll', axis: 0, color: '#ff0000', function: 1 }]

    it('round-trips expressions without changing viewer configuration', () => {
        const result = parsePortablePreset(JSON.stringify(createPortablePreset('Attitude', expressions)))

        expect(result).toEqual({
            name: 'Attitude',
            fields: [['ATT.Roll', 0, '#ff0000', 1]]
        })
    })

    it('rejects unversioned preset data', () => {
        expect(() => parsePortablePreset('{"name":"Old"}')).toThrow('Unsupported preset schema version')
    })
})
