/** Authored small (16) and large (24) caps. The former medium spelling aliases large. */
export type LabKbdSize = 's' | 'l' | 'm';

export function kbdSize(size: LabKbdSize): 's' | 'l' {
  return size === 's' ? 's' : 'l';
}
