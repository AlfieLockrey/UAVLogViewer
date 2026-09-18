import { isolateTrace, setTraceVisibility } from '@/tools/traceVisibility.js'

describe('trace isolation', () => {
    const traces = [{ visible: true }, { visible: true }, { visible: true }]

    it('shows only the selected trace when isolating', () => {
        expect(isolateTrace(traces, 1, true)).toEqual([
            { visible: false, isolated: false },
            { visible: true, isolated: true },
            { visible: false, isolated: false }
        ])
    })

    it('clears isolation when another trace is shown', () => {
        const isolated = isolateTrace(traces, 1, true)
        expect(setTraceVisibility(isolated, 0, true)).toEqual([
            { visible: true, isolated: false },
            { visible: true, isolated: false },
            { visible: false, isolated: false }
        ])
    })

    it('clears isolation when the isolated trace is hidden', () => {
        const isolated = isolateTrace(traces, 1, true)
        expect(setTraceVisibility(isolated, 1, false)[1]).toEqual({ visible: false, isolated: false })
    })

    it('shows every trace when isolation is manually cleared', () => {
        const isolated = isolateTrace(traces, 1, true)
        expect(isolateTrace(isolated, 1, false)).toEqual([
            { visible: true, isolated: false },
            { visible: true, isolated: false },
            { visible: true, isolated: false }
        ])
    })
})
