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
    remote_method?: string
    params?: unknown
    args?: unknown
    payload?: unknown
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

const methodKeys: Array<keyof PauseEventPayload> = ['method', 'name', 'remote_method']

const getPauseEventMethod = (payload: PauseEventPayload): string | null => {
    for (const key of methodKeys) {
        const value = payload?.[key]
        if (typeof value === 'string') return value
    }
    return null
}

const pauseParamKeys = ['event', 'params', 'payload', 'data', 'args'] as const

const findPauseEventParams = (value: unknown, depth = 0): Record<string, unknown> | null => {
    if (depth > 5 || value === null || value === undefined) return null

    if (Array.isArray(value)) {
        for (const item of value) {
            const nested = findPauseEventParams(item, depth + 1)
            if (nested) return nested
        }
        return null
    }

    if (typeof value === 'object') {
        const record = value as Record<string, unknown>
        if (
            record.event_id !== undefined ||
            record.eventId !== undefined ||
            record.eventID !== undefined
        ) {
            return record
        }

        for (const key of pauseParamKeys) {
            if (key in record) {
                const nested = findPauseEventParams(record[key], depth + 1)
                if (nested) return nested
            }
        }
    }

    return null
}

const normalizePauseEvent = (payload: PauseEventPayload): PauseEvent | null => {
    const method = getPauseEventMethod(payload)
    if (!isPauseEventMethod(method)) return null

    const params = findPauseEventParams([payload.params, payload.args, payload.payload, payload])
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
