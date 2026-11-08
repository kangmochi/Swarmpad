import { Buffer } from "buffer";

/**
 * Some wallet code still expects a bare `Buffer` global: the copy of
 * js-sha256 that ships inside the HERE wallet reads it directly. The bundler
 * resolves `require("buffer")` for its own modules, but a free variable has to
 * exist at runtime, so it is set here before the app renders.
 */
if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer as unknown as typeof globalThis.Buffer;
}
