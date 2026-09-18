export const annotationSources = ['events', 'params', 'msg', 'statusText']

export const emptyAnnotationSets = () => ({
    events: [],
    params: [],
    msg: [],
    statusText: [],
    modes: []
})

export const shortenAnnotationText = (text, maxLength = 25) => {
    const value = typeof text === 'string' ? text.trim() : ''
    if (!value) return ''
    return value.length > maxLength ? value.slice(0, maxLength - 1) + '…' : value
}

export const createTextMessageAnnotations = (messages, source) => {
    const annotations = []
    let offset = -300
    for (const message of messages || []) {
        const time = Number(message[0])
        const text = typeof message[2] === 'string' ? message[2].trim() : ''
        if (message[3] !== source || !Number.isFinite(time) || !text) continue
        annotations.push({
            xref: 'x',
            yref: 'paper',
            x: time,
            y: 0,
            yanchor: 'bottom',
            text: shortenAnnotationText(text),
            hovertext: text,
            captureevents: true,
            showarrow: true,
            arrowwidth: 1,
            arrowcolor: source === 'MSG' ? '#1f77b4' : '#9467bd',
            ay: offset,
            ax: 0
        })
        offset += 23
        if (offset > 0) offset = -300
    }
    return annotations
}

export const combineAnnotationSets = (sets, visibility) => {
    const annotations = [...(sets.modes || [])]
    for (const source of annotationSources) {
        if (visibility[source]) annotations.push(...(sets[source] || []))
    }
    return annotations
}
