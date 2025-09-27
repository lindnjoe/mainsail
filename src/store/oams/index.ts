import { Module } from 'vuex'
import { RootState } from '@/store/types'

export type PauseEvent = {
    method: string
    params: {
        event_id: string
        message: string
        reason?: string
        requires_ack?: boolean
        [key: string]: any
    }
}

export type OamsState = {
    pending: Record<string, PauseEvent>
    activeId: string | null
}

const getNextActiveId = (pending: Record<string, PauseEvent>): string | null => {
    return Object.keys(pending)[0] ?? null
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
        handleRemoteEvent({ commit }, remote: PauseEvent) {
            if (remote.method === 'oams.pause_event') {
                commit('enqueue', remote)
            }
        },
    },
}
