import Vue from 'vue'
import { ActionTree } from 'vuex'
import { SocketState } from '@/store/socket/types'
import { RootState } from '@/store/types'

type RemotePayload = {
    method?: string
    name?: string
    remote_method?: string
    params?: unknown
    args?: unknown
    payload?: unknown

    data?: unknown

    [key: string]: unknown
}

const remoteMethodKeys: Array<'method' | 'name' | 'remote_method'> = ['method', 'name', 'remote_method']


const isRecord = (value: unknown): value is RemotePayload => {
    return !!value && typeof value === 'object' && !Array.isArray(value)
}


const getRemoteMethod = (payload: RemotePayload | null): string | null => {
    if (!payload) return null

    for (const key of remoteMethodKeys) {
        const value = payload[key]
        if (typeof value === 'string') return value
    }

    return null
}


const isOamsMethod = (method: string | null | undefined): method is string => {
    if (typeof method !== 'string') return false
    return method.startsWith('oams.') || method.startsWith('open_ams.')
}

const normalizeTuplePayload = (method: string, candidate: unknown): RemotePayload => {
    if (isRecord(candidate)) {
        if (remoteMethodKeys.some((key) => typeof candidate[key] === 'string')) {
            return {
                ...candidate,
                method,
            }
        }

        if ('params' in candidate || 'args' in candidate || 'payload' in candidate) {
            return {
                ...candidate,
                method,
            }
        }

        return {
            method,
            params: candidate,
        }
    }

    if (Array.isArray(candidate)) {
        return {
            method,
            args: candidate,
        }
    }

    if (candidate !== undefined) {
        return {
            method,
            params: candidate,
        }
    }

    return { method }
}

const findOamsRemotePayload = (value: unknown, depth = 0): RemotePayload | null => {
    if (depth > 8 || value === null || value === undefined) return null

    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
            const item = value[index]

            if (typeof item === 'string') {
                if (isOamsMethod(item)) {
                    const next = index + 1 < value.length ? value[index + 1] : undefined
                    return normalizeTuplePayload(item, next)
                }

                if (index + 1 < value.length) {
                    const combined = {
                        method: item,
                        params: value[index + 1],
                    }
                    const nested = findOamsRemotePayload(combined, depth + 1)
                    if (nested) return nested
                }
            }

            const nested = findOamsRemotePayload(item, depth + 1)
            if (nested) return nested
        }
        return null
    }

    if (isRecord(value)) {
        const method = getRemoteMethod(value)
        if (isOamsMethod(method)) {
            if (value.method === method) return value
            return {
                ...value,
                method,
            }
        }

        for (const key of ['params', 'args', 'payload', 'data']) {
            if (key in value) {
                const nested = findOamsRemotePayload(value[key], depth + 1)
                if (nested) return nested
            }
        }
    }

    if (typeof value === 'string' && isOamsMethod(value)) {
        return { method: value }
    }


    return null
}

export const actions: ActionTree<SocketState, RootState> = {
    reset({ commit }) {
        commit('setDisconnected')
        commit('clearLoadings')
        commit('reset')
    },

    setData({ commit }, payload) {
        commit('setData', payload)
    },

    async setSocket({ commit, state }, payload) {
        commit('setData', payload)

        if ('$socket' in Vue.prototype) {
            const normPath = payload.path.replaceAll(/(^\/*)|(\/*$)/g, '')
            const path = normPath.length > 0 ? `/${normPath}` : ''

            await Vue.prototype.$socket.close()
            await Vue.prototype.$socket.setUrl(
                state.protocol + '://' + payload.hostname + ':' + payload.port + path + '/websocket'
            )
            await Vue.prototype.$socket.connect()
        }
    },

    onOpen({ commit, dispatch, rootState }) {
        //set socket connection to connected
        commit('setConnected')

        // init server
        dispatch('server/init', null, { root: true })

        if (!rootState?.server?.updateManager?.updateResponse.complete)
            commit('server/updateManager/setStatus', { busy: false }, { root: true })
    },

    onClose({ commit }) {
        commit('setDisconnected')
        commit('oams/reset', null, { root: true })
    },

    onMessage({ commit, dispatch }, payload) {
        switch (payload.method) {
            case 'notify_status_update':
                dispatch('printer/getData', payload.params[0], { root: true })
                break

            case 'notify_gcode_response':
                dispatch('server/addEvent', Object.assign({ result: payload.params[0] }, { send: false }), {
                    root: true,
                })
                break

            case 'notify_klippy_ready':
                commit('server/setKlippyConnected', null, { root: true })
                dispatch('server/stopKlippyConnectedInterval', null, { root: true })
                dispatch('server/stopKlippyStateInterval', null, { root: true })
                dispatch('printer/init', null, { root: true })
                dispatch('oams/requestSnapshot', undefined, { root: true })
                break

            case 'notify_klippy_disconnected':
                dispatch('server/setKlippyDisconnected', null, { root: true })
                commit('oams/reset', null, { root: true })
                break

            case 'notify_klippy_shutdown':
                dispatch('server/setKlippyShutdown', null, { root: true })
                commit('oams/reset', null, { root: true })
                break

            case 'notify_proc_stat_update':
                dispatch('server/updateProcStats', payload.params[0], { root: true })
                break

            case 'notify_cpu_throttled':
                commit('server/setThrottledState', payload.params[0], { root: true })
                break

            case 'notify_filelist_changed':
                dispatch('files/filelist_changed', payload.params[0], { root: true })
                break

            case 'notify_metadata_update':
                commit('files/setMetadata', payload.params[0], { root: true })
                break

            case 'notify_power_changed':
                commit('server/power/setStatus', payload.params[0], { root: true })
                break

            case 'notify_update_response':
                commit('server/updateManager/addUpdateResponse', payload.params[0], { root: true })
                break

            case 'notify_update_refreshed':
                dispatch('server/updateManager/onUpdateStatus', payload.params[0], { root: true })
                break

            case 'notify_history_changed':
                dispatch('server/history/getChanged', payload.params[0], { root: true })
                break

            case 'notify_service_state_changed':
                dispatch('server/serviceStateChanged', payload.params[0], { root: true })
                break

            case 'notify_timelapse_event':
                dispatch('server/timelapse/getEvent', payload.params[0], { root: true })
                break

            case 'notify_job_queue_changed':
                dispatch('server/jobQueue/getEvent', payload.params[0], { root: true })
                break

            case 'notify_remote_method': {

                const remotePayload = findOamsRemotePayload(payload.params)

                if (remotePayload) {
                    dispatch('oams/handleRemoteEvent', remotePayload, { root: true })

                }
                break
            }

            case 'notify_announcement_update':
                dispatch('server/announcements/getList', payload.params[0], { root: true })
                break

            case 'notify_announcement_dismissed':
                dispatch('server/announcements/getDismissed', payload.params[0], { root: true })
                break

            case 'notify_announcement_wake':
                dispatch('server/announcements/getWaked', payload.params[0], { root: true })
                break

            case 'notify_webcams_changed':
                dispatch('gui/webcams/initStore', payload.params[0], { root: true })
                break

            case 'notify_active_spool_set':
                dispatch('server/spoolman/getActiveSpoolId', payload.params[0], { root: true })
                break

            case 'notify_sensor_update':
                dispatch('server/sensor/updateSensors', payload.params[0], { root: true })
                break

            default:
                window.console.debug(payload)
        }
    },

    addLoading({ commit }, payload: string) {
        commit('addLoading', payload)
    },

    removeLoading({ commit }, payload: string) {
        commit('removeLoading', payload)
    },

    clearLoadings({ commit }) {
        commit('clearLoadings')
    },

    addInitModule({ commit }, payload: string) {
        commit('addInitModule', payload)
    },

    // remove only one module from init component like 'server/spoolman/getActiveSpoolId'
    removeInitModule({ commit }, payload: string) {
        commit('removeInitModule', payload)
    },

    // remove a complete init component like 'server/spoolman'
    removeInitComponent({ commit }, payload: string) {
        commit('removeInitComponent', payload)
    },

    reportDebug(_, payload) {
        window.console.log(payload)
    },

    setConnectionFailed({ commit }, payload) {
        commit('setDisconnected', payload)
    },
}
