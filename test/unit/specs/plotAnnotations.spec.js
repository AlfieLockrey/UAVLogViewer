import {
    combineAnnotationSets, createTextMessageAnnotations, shortenAnnotationText
} from '@/tools/plotAnnotations.js'

describe('plot annotations', () => {
    it('shortens message labels while keeping complete hover text', () => {
        const text = 'This message is longer than twenty five characters.'
        const annotations = createTextMessageAnnotations([[1000, 0, text, 'MSG']], 'MSG')

        expect(shortenAnnotationText(text)).toBe('This message is longer t…')
        expect(annotations).toEqual([expect.objectContaining({
            x: 1000,
            text: 'This message is longer t…',
            hovertext: text
        })])
    })

    it('keeps MSG and STATUSTEXT annotations separate and skips invalid records', () => {
        const messages = [
            [1000, 0, 'DataFlash message', 'MSG'],
            [2000, 6, 'Vehicle warning', 'STATUSTEXT'],
            [NaN, 0, 'Invalid time', 'MSG'],
            [3000, 0, '   ', 'MSG']
        ]

        expect(createTextMessageAnnotations(messages, 'MSG')).toHaveLength(1)
        expect(createTextMessageAnnotations(messages, 'STATUSTEXT')).toHaveLength(1)
    })

    it('combines only the selected annotation sources with flight modes', () => {
        const sets = {
            modes: [{ text: 'Mode' }],
            events: [{ text: 'Event' }],
            params: [{ text: 'Param' }],
            msg: [{ text: 'MSG' }],
            statusText: [{ text: 'STATUSTEXT' }]
        }
        const visibility = { events: true, params: false, msg: true, statusText: false }

        expect(combineAnnotationSets(sets, visibility).map(annotation => annotation.text))
            .toEqual(['Mode', 'Event', 'MSG'])
    })
})
