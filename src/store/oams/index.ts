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
    params?: PauseEventParams | PauseEventParams[] | null
}

export type OamsState = {
    pending: Record<string, PauseEvent>
    activeId: string | null
}

const getNextActiveId = (pending: Record<string, PauseEvent>): string | null => {
    return Object.keys(pending)[0] ?? null
}

const normalizePauseEvent = (payload: PauseEventPayload): PauseEvent | null => {
    if (!payload?.method) return null

    const params = Array.isArray(payload.params) ? payload.params[0] : payload.params
    if (!params || typeof params !== 'object') return null

    const eventId = (params as PauseEventParams).event_id
    if (!eventId) return null

    return {
        method: payload.method,
        params: params as PauseEventParams,
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
            if (pauseEvent?.method === 'oams.pause_event') {
                commit('enqueue', pauseEvent)
            }
        },
    },
}
