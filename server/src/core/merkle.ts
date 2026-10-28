import { createHash } from 'node:crypto';

/** Merkle tree over hex leaf hashes (e.g. pick commitHash). Deterministic pairwise hashing. */
export function hashPair(a: string, b: string): string {
  const [left, right] = a <= b ? [a, b] : [b, a];
  return createHash('sha256').update(left + right).digest('hex');
}

export function merkleRoot(leaves: string[]): string {
  if (leaves.length === 0) throw new Error('no leaves');
  let layer = [...leaves];
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]!;
      const right = layer[i + 1] ?? left;
      next.push(hashPair(left, right));
    }
    layer = next;
  }
  return layer[0]!;
}

export function merkleProof(leaves: string[], index: number): string[] {
  if (index < 0 || index >= leaves.length) throw new Error('index out of range');
  const proof: string[] = [];
  let layer = [...leaves];
  let idx = index;
  while (layer.length > 1) {
    const sibling = idx % 2 === 0 ? layer[idx + 1] ?? layer[idx]! : layer[idx - 1]!;
    proof.push(sibling);
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]!;
      const right = layer[i + 1] ?? left;
      next.push(hashPair(left, right));
    }
    layer = next;
    idx = Math.floor(idx / 2);
  }
  return proof;
}

export function verifyProof(leaf: string, proof: string[], root: string): boolean {
  let hash = leaf;
  for (const sibling of proof) hash = hashPair(hash, sibling);
  return hash === root;
}
