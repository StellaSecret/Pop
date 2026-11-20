/* @ts-self-types="./pop_engine.d.ts" */

/**
 * Opaque handle to one running game, owned by the JavaScript side.
 */
export class PopGame {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PopGameFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_popgame_free(ptr, 0);
    }
    /**
     * Number of floats in the snapshot header (currently 9).
     * @returns {number}
     */
    static header_len() {
        const ret = wasm.popgame_header_len();
        return ret >>> 0;
    }
    /**
     * Header field offsets as a plain JS object.
     * @returns {any}
     */
    static header_offsets() {
        const ret = wasm.popgame_header_offsets();
        return ret;
    }
    /**
     * @returns {boolean}
     */
    is_running() {
        const ret = wasm.popgame_is_running(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Creates a game for a play area of `width` x `height` CSS pixels.
     *
     * * `difficulty` — 0 = Facile, 1 = Normal, 2 = Difficile, 3 = Extrême.
     * * `seed` — any finite number; pass `Date.now()` for a fresh round.
     * @param {number} width
     * @param {number} height
     * @param {number} difficulty
     * @param {number} seed
     */
    constructor(width, height, difficulty, seed) {
        const ret = wasm.popgame_new(width, height, difficulty, seed);
        this.__wbg_ptr = ret;
        PopGameFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Pauses or resumes the simulation (no movement, no spawning).
     */
    pause() {
        wasm.popgame_pause(this.__wbg_ptr);
    }
    /**
     * Attempts to pop the topmost active balloon covering `(x, y)`.
     *
     * Returns `{ popped, id, x, y, color_index, points, combo }`. On a miss,
     * `popped` is `false` and all other fields are zero.
     * @param {number} x
     * @param {number} y
     * @returns {any}
     */
    pop_at(x, y) {
        const ret = wasm.popgame_pop_at(this.__wbg_ptr, x, y);
        return ret;
    }
    /**
     * Resizes the play area and clamps every balloon back inside it.
     * @param {number} width
     * @param {number} height
     */
    resize(width, height) {
        wasm.popgame_resize(this.__wbg_ptr, width, height);
    }
    /**
     * Clears the round, resets score and spawns a fresh population.
     */
    restart() {
        wasm.popgame_restart(this.__wbg_ptr);
    }
    resume() {
        wasm.popgame_resume(this.__wbg_ptr);
    }
    /**
     * Returns to the endless arcade mode.
     */
    set_arcade_mode() {
        wasm.popgame_set_arcade_mode(this.__wbg_ptr);
    }
    /**
     * Switches difficulty and starts a fresh round.
     * @param {number} difficulty
     */
    set_difficulty(difficulty) {
        wasm.popgame_set_difficulty(this.__wbg_ptr, difficulty);
    }
    /**
     * Overrides the target balloon count. `0` restores automatic scaling.
     * @param {number} count
     */
    set_target_count(count) {
        wasm.popgame_set_target_count(this.__wbg_ptr, count);
    }
    /**
     * Number of `f32` values in the snapshot buffer.
     * @returns {number}
     */
    snapshot_len() {
        const ret = wasm.popgame_snapshot_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Byte offset of the flat snapshot buffer inside WASM linear memory.
     * Recompute this every frame: the buffer can move when it is resized.
     * @returns {number}
     */
    snapshot_ptr() {
        const ret = wasm.popgame_snapshot_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Starts a fixed-population challenge: no respawn, timer stops when cleared.
     * @param {number} count
     */
    start_challenge(count) {
        wasm.popgame_start_challenge(this.__wbg_ptr, count);
    }
    /**
     * Advances the simulation by `dt` seconds. Deltas above 50 ms are
     * clamped internally to keep the physics stable after tab switches.
     * @param {number} dt
     */
    update(dt) {
        wasm.popgame_update(this.__wbg_ptr, dt);
    }
    /**
     * Number of floats per balloon record (currently 7).
     * @returns {number}
     */
    static view_stride() {
        const ret = wasm.popgame_view_stride();
        return ret >>> 0;
    }
}
if (Symbol.dispose) PopGame.prototype[Symbol.dispose] = PopGame.prototype.free;

/**
 * Returns static game configuration as a plain JS object. Call once at
 * startup to build the difficulty selector and the colour palette.
 * @returns {any}
 */
export function info() {
    const ret = wasm.info();
    return ret;
}

/**
 * Returns the `WebAssembly.Memory` backing the snapshot buffer.
 * @returns {any}
 */
export function wasm_memory() {
    const ret = wasm.wasm_memory();
    return ret;
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_208446807d0d1e30: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg___wbindgen_memory_17a1178bc3328ea3: function() {
            const ret = wasm.memory;
            return ret;
        },
        __wbg___wbindgen_throw_4c88d8bf264fd984: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_new_37eb45aaf5eeb820: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_new_cd4348290afae586: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_set_8c2c6cf77abfa75b: function(arg0, arg1, arg2) {
            arg0[arg1] = arg2;
        },
        __wbg_set_d2d33b52458e984a: function(arg0, arg1, arg2) {
            arg0[arg1 >>> 0] = arg2;
        },
        __wbindgen_generic_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_generic_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_generic_0000000000000003: function(arg0) {
            // Cast intrinsic for `U64 -> Externref`.
            const ret = BigInt.asUintN(64, arg0);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            table.set(0, undefined);
            table.set(1024, undefined);
            table.set(1025, null);
            table.set(1026, true);
            table.set(1027, false);
        },
    };
    return {
        __proto__: null,
        "./pop_engine_bg.js": import0,
    };
}

const PopGameFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_popgame_free(ptr, 1));

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(bytes) {
    numBytesDecoded += bytes.length;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
        cachedTextDecoder.decode();
        numBytesDecoded = bytes.length;
    }
    return cachedTextDecoder.decode(bytes);
}

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

let __wbg_init_promise;
async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;
    if (__wbg_init_promise === undefined) {
        __wbg_init_promise = __wbg_init_once(module_or_path);
        __wbg_init_promise.catch(() => { __wbg_init_promise = undefined; });
    }
    return __wbg_init_promise;
}

async function __wbg_init_once(module_or_path) {

    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('pop_engine_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
