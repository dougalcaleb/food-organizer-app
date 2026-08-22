/**
 * Strip Vue reactivity before handing a record to IndexedDB.
 *
 * Store state is reactive, so a record read back out of a store carries Proxy
 * wrappers on its nested arrays (`tags`, `ingredients`). IndexedDB clones its
 * input with the structured clone algorithm, which rejects a Proxy outright —
 * `DataCloneError: [object Array] could not be cloned` — so every write has to
 * go through here.
 *
 * A JSON round trip rather than a recursive `toRaw`, because these records are
 * JSON-serializable by definition: they are exactly what `backup.ts` writes to
 * a file. Anything that would not survive JSON does not belong in a record.
 */
export function toPlain<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T
}
