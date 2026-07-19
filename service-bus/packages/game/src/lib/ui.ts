/** Shared view-only UI types. */

/** Card-shaped overlays rendered by `Modal.svelte`. */
export type ModalKind = "levels" | "help";

/**
 * Everything the header can open. The Field Guide (WP3) is not a Modal: it is a
 * full-page view, because eight sections of reference material do not belong in a
 * 640px card. It shares this union so `Header` needs only one callback, and so
 * App's "a menu is open, so pause the mission" effect covers it for free.
 */
export type OverlayKind = ModalKind | "fieldguide";
