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


export type FpsStatus = {
    id: string
    fps: string | null
    lane: string | null
    status: string | null
    message: string | null
    reason: string | null
    details: Record<string, unknown> | null
    isError: boolean
    eventId: string | null
    updatedAt: number
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
    statuses: Record<string, FpsStatus>
}

const getNextActiveId = (pending: Record<string, PauseEvent>): string | null => {
    return Object.keys(pending)[0] ?? null
}


const isOamsMethod = (method: string | null | undefined): method is string => {
    if (typeof method !== 'string') return false

    return method.startsWith('oams.') || method.startsWith('open_ams.')
}

const isPauseEventMethod = (method: string | null | undefined): method is string => {
    if (!isOamsMethod(method)) return false

    return method.endsWith('pause_event')
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


const statusParamKeys = ['params', 'payload', 'data', 'args', 'event', 'details'] as const

const statusIdentifierKeys = ['fps', 'fps_id', 'feeder', 'id', 'identifier', 'lane', 'unit'] as const

const statusKeys = ['status', 'state', 'status_text', 'statusText'] as const

const statusMessageKeys = ['message', 'status_message', 'statusMessage', 'detail', 'description'] as const

const reasonKeys = ['reason', 'cause'] as const

const severityKeys = ['severity', 'level', 'type'] as const

const toStringOrNull = (value: unknown): string | null => {
    if (value === null || value === undefined) return null
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return null
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    return !!value && typeof value === 'object' && !Array.isArray(value)
}


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

const findStatusParams = (value: unknown, depth = 0): Record<string, unknown> | null => {
    if (depth > 5 || value === null || value === undefined) return null

    if (Array.isArray(value)) {
        for (const item of value) {
            const nested = findStatusParams(item, depth + 1)
            if (nested) return nested
        }
        return null
    }

    if (isPlainObject(value)) {
        const record = value as Record<string, unknown>

        for (const key of statusIdentifierKeys) {
            if (toStringOrNull(record[key])) return record
        }

        for (const key of statusKeys) {
            if (typeof record[key] === 'string') return record
        }

        if ('details' in record && isPlainObject(record.details)) {
            return record
        }

        for (const key of statusParamKeys) {
            if (key in record) {
                const nested = findStatusParams(record[key], depth + 1)
                if (nested) return nested
            }
        }
    }

    return null
}

const getStatusId = (params: Record<string, unknown>): string | null => {
    for (const key of statusIdentifierKeys) {
        const value = toStringOrNull(params[key])
        if (value) return value
    }

    const eventId =
        toStringOrNull(params.event_id) ?? toStringOrNull(params.eventId) ?? toStringOrNull(params.eventID)
    if (eventId) return eventId

    return null
}

const pickFirstString = (params: Record<string, unknown>, keys: readonly string[]): string | null => {
    for (const key of keys) {
        const value = toStringOrNull(params[key])
        if (value) return value
    }
    return null
}

type StatusUpdate = {
    id: string
    fps?: string | null
    lane?: string | null
    status?: string | null
    message?: string | null
    reason?: string | null
    details?: Record<string, unknown> | null
    isError?: boolean
    eventId?: string | null
}

const normalizeStatusUpdate = (
    payload: PauseEventPayload,
    pauseEvent: PauseEvent | null
): StatusUpdate | null => {
    const method = getPauseEventMethod(payload)
    if (!isOamsMethod(method)) return null

    const params = findStatusParams([payload.params, payload.args, payload.payload, payload])
    if (!params) return null

    const id = getStatusId(params)
    if (!id) return null

    const fps =
        toStringOrNull(params['fps']) ??
        toStringOrNull(params['fps_id']) ??
        toStringOrNull(params['feeder']) ??
        toStringOrNull(params['identifier'])

    const lane =
        toStringOrNull(params['lane']) ?? toStringOrNull(params['unit']) ?? toStringOrNull(params['name'])

    const status = pickFirstString(params, statusKeys)
    const message = pickFirstString(params, statusMessageKeys)
    const reason = pickFirstString(params, reasonKeys)
    const details = isPlainObject(params['details'])
        ? (params['details'] as Record<string, unknown>)
        : null

    const eventId =
        toStringOrNull(params['event_id']) ??
        toStringOrNull(params['eventId']) ??
        toStringOrNull(params['eventID']) ??
        pauseEvent?.params?.event_id ??
        null

    let isError = pauseEvent ? true : false

    if (!isError) {
        const severity = pickFirstString(params, severityKeys)
        if (severity?.toLowerCase() === 'error') {
            isError = true
        }

        const statusLower = status?.toLowerCase() ?? null
        if (statusLower && ['error', 'fault', 'stuck', 'pause'].some((token) => statusLower.includes(token))) {
            isError = true
        }

        const requiresAck = params['requires_ack'] ?? params['requiresAck']
        if (requiresAck === true) {
            isError = true
        }

        if (params['error'] === true || params['is_error'] === true) {
            isError = true
        }
    }

    return {
        id,
        fps: fps ?? toStringOrNull(id),
        lane,
        status,
        message,
        reason,
        details,
        isError,
        eventId,

    }
}

export const oams: Module<OamsState, RootState> = {
    namespaced: true,
    state: (): OamsState => ({
        pending: {},
        activeId: null,
        statuses: {},
    }),
    getters: {
        active(state): PauseEvent | null {
            if (!state.activeId) return null
            return state.pending[state.activeId] ?? null
        },
        pendingList(state): PauseEvent[] {
            return Object.values(state.pending)
        },
        statusList(state): FpsStatus[] {
            return Object.values(state.statuses).sort((a, b) => a.id.localeCompare(b.id))
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

            let mutated = false
            const nextStatuses = { ...state.statuses }
            Object.entries(nextStatuses).forEach(([id, status]) => {
                if (status.eventId === eventId) {
                    nextStatuses[id] = {
                        ...status,
                        isError: false,
                        eventId: null,
                        updatedAt: Date.now(),
                    }
                    mutated = true
                }
            })

            if (mutated) {
                state.statuses = nextStatuses
            }
        },
        setActive(state, eventId: string | null) {
            if (eventId && !state.pending[eventId]) return
            state.activeId = eventId
        },
        setStatus(state, update: StatusUpdate) {
            const previous = state.statuses[update.id]
            const normalizedDetails =
                update.details === undefined
                    ? previous?.details ?? null
                    : update.details
                    ? { ...update.details }
                    : null

            const next: FpsStatus = {
                id: update.id,
                fps:
                    update.fps === undefined
                        ? previous?.fps ?? update.id
                        : update.fps ?? previous?.fps ?? update.id,
                lane:
                    update.lane === undefined
                        ? previous?.lane ?? null
                        : update.lane ?? previous?.lane ?? null,
                status:
                    update.status === undefined
                        ? previous?.status ?? null
                        : update.status ?? previous?.status ?? null,
                message:
                    update.message === undefined
                        ? previous?.message ?? null
                        : update.message ?? previous?.message ?? null,
                reason:
                    update.reason === undefined
                        ? previous?.reason ?? null
                        : update.reason ?? previous?.reason ?? null,
                details: normalizedDetails,
                isError:
                    update.isError === undefined
                        ? previous?.isError ?? false
                        : update.isError ?? previous?.isError ?? false,
                eventId:
                    update.eventId === undefined
                        ? previous?.eventId ?? null
                        : update.eventId ?? null,
                updatedAt: Date.now(),
            }

            state.statuses = {
                ...state.statuses,
                [update.id]: next,
            }
        },
    },
    actions: {
        handleRemoteEvent({ commit }, remote: PauseEventPayload) {
            const pauseEvent = normalizePauseEvent(remote)

            const statusUpdate = normalizeStatusUpdate(remote, pauseEvent)

            if (statusUpdate) {
                commit('setStatus', statusUpdate)
            }

            if (pauseEvent && isPauseEventMethod(pauseEvent.method)) {
                commit('enqueue', pauseEvent)

                const paramsRecord = pauseEvent.params as Record<string, unknown>
                const statusId = getStatusId(paramsRecord)

                if (statusId) {
                    commit('setStatus', {
                        id: statusId,
                        fps: toStringOrNull(paramsRecord['fps']) ?? statusId,
                        lane: toStringOrNull(paramsRecord['lane']),
                        status: statusUpdate?.status ?? 'paused',
                        message: toStringOrNull(paramsRecord['message']),
                        reason: toStringOrNull(paramsRecord['reason']),
                        details: isPlainObject(paramsRecord['details'])
                            ? (paramsRecord['details'] as Record<string, unknown>)
                            : null,
                        isError: true,
                        eventId: pauseEvent.params.event_id,
                    })
                }

            }
        },
    },
}
