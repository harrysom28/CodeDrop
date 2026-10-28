import { test } from 'node:test';
import assert from 'node:assert/strict';
import { merkleProof, merkleRoot, verifyProof } from '../src/core/merkle.js';

test('merkle root and proof verify without network', () => {
  const leaves = ['aa', 'bb', 'cc', 'dd'].map((x) => x.repeat(32).slice(0, 64));
  const root = merkleRoot(leaves);
  for (let i = 0; i < leaves.length; i++) {
    const proof = merkleProof(leaves, i);
    assert.ok(verifyProof(leaves[i]!, proof, root));
  }
  assert.ok(!verifyProof(leaves[0]!, merkleProof(leaves, 1), root));
});
