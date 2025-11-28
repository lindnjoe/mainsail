import { GetterTree } from 'vuex'
import { ServerSpoolmanState } from './types'

export const getters: GetterTree<ServerSpoolmanState, any> = {
    loadedLaneMap: (state) => {
        const spools = state.spools ?? []

        return spools.reduce<Record<number, string>>((acc, spool) => {
            if (spool.loaded_lane) {
                acc[spool.id] = spool.loaded_lane
            }

            return acc
        }, {})
    },
}
