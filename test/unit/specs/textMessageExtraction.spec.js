import { DataflashDataExtractor } from '@/tools/dataflashDataExtractor.js'

describe('text-message extraction', () => {
    it('preserves MSG and STATUSTEXT sources', () => {
        const messages = {
            // eslint-disable-next-line camelcase
            MSG: { time_boot_ms: [1000], Message: ['Boot complete'] },
            // eslint-disable-next-line camelcase
            STATUSTEXT: { time_boot_ms: [2000], severity: [4], text: ['Battery low'] }
        }

        expect(DataflashDataExtractor.extractTextMessages(messages)).toEqual([
            [2000, 4, 'Battery low', 'STATUSTEXT'],
            [1000, 0, 'Boot complete', 'MSG']
        ])
    })
})
