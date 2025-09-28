import { Module } from 'vuex'
import { RootState } from '@/store/types'

type PauseEventParams = {
    event_id: string
    message: string
    reason?: string
    requires_ack?: boolean
    [key: string]: any
}

export type PauseEvent = {
    method: string
    params: PauseEventParams
}

type PauseEventPayload = {
    method?: string
    name?: string
    params?: PauseEventParams | PauseEventParams[] | null
}

export type OamsState = {
    pending: Record<string, PauseEvent>
    activeId: string | null
}

const getNextActiveId = (pending: Record<string, PauseEvent>): string | null => {
    return Object.keys(pending)[0] ?? null
}

const isPauseEventMethod = (method: string | null | undefined): method is string => {
    if (typeof method !== 'string') return false

    return method === 'oams.pause_event' || method === 'open_ams.pause_event'
}

const getPauseEventMethod = (payload: PauseEventPayload): string | null => {
    if (typeof payload?.method === 'string') return payload.method
    if (typeof payload?.name === 'string') return payload.name
    return null
}

const getPauseEventParams = (
    params?: PauseEventParams | PauseEventParams[] | null
): Record<string, unknown> | null => {
    if (Array.isArray(params)) {
        const firstParam = params.find((param) => param && typeof param === 'object')
        return (firstParam as Record<string, unknown>) ?? null
    }

    if (params && typeof params === 'object') return params as Record<string, unknown>

    return null
}

const normalizePauseEvent = (payload: PauseEventPayload): PauseEvent | null => {
    const method = getPauseEventMethod(payload)
    if (!isPauseEventMethod(method)) return null

    const params = getPauseEventParams(payload.params)
    if (!params) return null

    const rawEventId = params.event_id ?? params.eventId ?? params.eventID
    if (rawEventId === undefined || rawEventId === null) return null

    const eventId = String(rawEventId)

    return {
        method,
        params: {
            ...(params as PauseEventParams),
            event_id: eventId,
        },
    }
}

export const oams: Module<OamsState, RootState> = {
    namespaced: true,
    state: (): OamsState => ({
        pending: {},
        activeId: null,
    }),
    getters: {
        active(state): PauseEvent | null {
            if (!state.activeId) return null
            return state.pending[state.activeId] ?? null
        },
        pendingList(state): PauseEvent[] {
            return Object.values(state.pending)
        },
    },
    mutations: {
        enqueue(state, payload: PauseEvent) {
            const eventId = payload?.params?.event_id
            if (!eventId) return

            state.pending = {
                ...state.pending,
                [eventId]: payload,
            }

            if (!state.activeId) {
                state.activeId = eventId
            }
        },
        clear(state, eventId: string) {
            if (!eventId) return
            if (state.pending[eventId]) {
                const nextPending = { ...state.pending }
                delete nextPending[eventId]
                state.pending = nextPending
            }

            if (state.activeId === eventId) {
                state.activeId = getNextActiveId(state.pending)
            }
        },
        setActive(state, eventId: string | null) {
            if (eventId && !state.pending[eventId]) return
            state.activeId = eventId
        },
    },
    actions: {
        handleRemoteEvent({ commit }, remote: PauseEventPayload) {
            const pauseEvent = normalizePauseEvent(remote)
            if (pauseEvent && isPauseEventMethod(pauseEvent.method)) {
                commit('enqueue', pauseEvent)
            }
        },
    },
}
