// Public surface of the message catalog. Generated types + metadata live in
// ./generated.ts (regenerate with `npm run gen:catalog`); this hand-written module
// re-exports them and adds small runtime helpers the sim uses.
export * from "./generated.ts";

import {
  MESSAGE_CATALOG,
  type CatalogMessageMeta,
  type MessageTypeName,
} from "./generated.ts";

/** Catalog metadata for a message type. */
export function catalogEntry(type: MessageTypeName): CatalogMessageMeta {
  return MESSAGE_CATALOG[type];
}

/** True if `type` is a known Tier-1 message type name. */
export function isKnownMessageType(type: string): type is MessageTypeName {
  return Object.prototype.hasOwnProperty.call(MESSAGE_CATALOG, type);
}
