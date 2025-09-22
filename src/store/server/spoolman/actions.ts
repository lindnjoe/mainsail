import Vue from 'vue'
import { ActionTree } from 'vuex'
import { RootState } from '@/store/types'
import { ServerSpoolmanState } from '@/store/server/spoolman/types'
import { SPOOLMAN_LOADED_LANE_EXTRA_FIELD } from '@/store/server/spoolman/constants'

function convertV2response(payload: { error?: { message: string } | null; response: any }) {
    if ((payload.error?.message ?? null) !== null) {
        Vue.$toast.error(payload.error?.message ?? 'unknown spoolman error')
        return null
    }

    // if the response is v2, we need to get the response into the payload
    if ('response' in payload) return payload.response

    return payload
}

export const actions: ActionTree<ServerSpoolmanState, RootState> = {
    reset({ commit }) {
        commit('reset')
    },

    init({ dispatch }) {
        Vue.$socket.emit('server.spoolman.get_spool_id', {}, { action: 'server/spoolman/getActiveSpoolId' })
        Vue.$socket.emit(
            'server.spoolman.proxy',
            {
                request_method: 'GET',
                path: '/v1/info',
                use_v2_response: true,
            },
            { action: 'server/spoolman/getInfo' }
        )
        Vue.$socket.emit(
            'server.spoolman.proxy',
            {
                request_method: 'GET',
                path: '/v1/health',
                use_v2_response: true,
            },
            { action: 'server/spoolman/getHealth' }
        )
        Vue.$socket.emit(
            'server.spoolman.proxy',
            {
                request_method: 'GET',
                path: '/v1/vendor',
                use_v2_response: true,
            },
            { action: 'server/spoolman/getVendors' }
        )

        dispatch('socket/addInitModule', 'server/spoolman/getActiveSpoolId', { root: true })
        dispatch('socket/addInitModule', 'server/spoolman/getHealth', { root: true })
        dispatch('socket/addInitModule', 'server/spoolman/getInfo', { root: true })
        dispatch('socket/addInitModule', 'server/spoolman/getVendors', { root: true })

        dispatch('socket/removeInitModule', 'server/spoolman/init', { root: true })
    },

    getActiveSpoolId({ commit, dispatch }, payload) {
        commit('setActiveSpoolId', payload.spool_id)
        dispatch('socket/removeInitModule', 'server/spoolman/getActiveSpoolId', { root: true })

        // also set active spool to null, if spool_id is 0 or null
        if ([null, 0].includes(payload.spool_id)) {
            commit('setActiveSpool', null)
            return
        }

        Vue.$socket.emit(
            'server.spoolman.proxy',
            {
                request_method: 'GET',
                use_v2_response: true,
                path: `/v1/spool/${payload.spool_id}`,
            },
            { action: 'server/spoolman/getActiveSpool' }
        )
    },

    getActiveSpool({ commit }, payload) {
        if ('requestParams' in payload) delete payload.requestParams
        payload = convertV2response(payload)
        if (payload === null) return

        commit('setActiveSpool', payload)
    },

    getHealth({ commit, dispatch }, payload) {
        delete payload.requestParams
        dispatch('socket/removeInitModule', 'server/spoolman/getHealth', { root: true })

        payload = convertV2response(payload)
        if (payload === null) return

        commit('setHealth', payload.status)
    },

    getInfo({ commit, dispatch }, payload) {
        delete payload.requestParams
        dispatch('socket/removeInitModule', 'server/spoolman/getInfo', { root: true })
        payload = convertV2response(payload)
        if (payload === null) return

        commit('setInfo', payload)
    },

    getVendors({ commit, dispatch }, payload) {
        delete payload.requestParams
        dispatch('socket/removeInitModule', 'server/spoolman/getVendors', { root: true })
        payload = convertV2response(payload)
        if (payload === null) return

        commit(
            'setVendors',
            Object.entries(payload).map((value) => value)
        )
    },

    refreshSpools({ dispatch }) {
        Vue.$socket.emit(
            'server.spoolman.proxy',
            {
                request_method: 'GET',
                path: '/v1/spool',
            },
            { action: 'server/spoolman/getSpools' }
        )

        dispatch('socket/addLoading', 'refreshSpools', { root: true })
    },

    getSpools({ commit, dispatch }, payload) {
        if ('requestParams' in payload) delete payload.requestParams
        dispatch('socket/removeLoading', 'refreshSpools', { root: true })
        payload = convertV2response(payload)
        if (payload === null) return

        const spools = Object.entries(payload).map((value) => value[1])
        commit('setSpools', spools)
    },

    setActiveSpool(_, id: number | null) {
        const params: { spool_id?: number } = {}
        if (id !== null) params['spool_id'] = id

        Vue.$socket.emit('server.spoolman.post_spool_id', params)
    },

    refreshActiveSpool({ state }) {
        if (state.active_spool_id === null) return

        Vue.$socket.emit(
            'server.spoolman.proxy',
            {
                request_method: 'GET',
                path: `/v1/spool/${state.active_spool_id}`,
            },
            { action: 'server/spoolman/getActiveSpool' }
        )
    },

    updateLoadedLaneExtra({ dispatch }, payload: { spoolId: number; laneName: string | null }) {
        const spoolId = Number(payload.spoolId)
        if (!spoolId || Number.isNaN(spoolId)) return

        const laneValue = payload.laneName === null ? '' : String(payload.laneName)
        const encodedValue = JSON.stringify(laneValue)

        Vue.$socket.emit(
            'server.spoolman.proxy',
            {
                request_method: 'PATCH',
                path: `/v1/spool/${spoolId}`,
                use_v2_response: true,
                body: {
                    extra: {
                        [SPOOLMAN_LOADED_LANE_EXTRA_FIELD]: encodedValue,
                    },
                },
            },
            {
                action: 'server/spoolman/handleUpdateLoadedLaneExtra',
                actionPayload: { spoolId },
            }
        )

        dispatch('socket/addLoading', 'updateLoadedLaneExtra', { root: true })
    },

    handleUpdateLoadedLaneExtra({ dispatch }, payload) {
        dispatch('socket/removeLoading', 'updateLoadedLaneExtra', { root: true })

        if ('requestParams' in payload) delete payload.requestParams

        payload = convertV2response(payload)
        if (payload === null) return

        dispatch('refreshSpools')
    },
}
