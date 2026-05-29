import { tableFromIPC, type Table } from 'apache-arrow';

export function decodeArrowTable(buffer: ArrayBuffer): Table {
  return tableFromIPC(new Uint8Array(buffer));
}
