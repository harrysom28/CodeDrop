import { config } from '../config.js';
import { merkleProof, merkleRoot } from '../core/merkle.js';
import { JobRun, PickModel } from '../models/index.js';

/**
 * Batch unanchored pick commitHashes into a Merkle root.
 * When ANCHORING_ENABLED and keys are present, a future viem write goes here.
 * Without network, we still store the root + proofs locally for GET /picks/:id/proof.
 */
export async function runAnchoring(now = new Date()) {
  if (!config.ANCHORING_ENABLED) return { anchored: 0, skipped: true };

  const picks = await PickModel.find({ anchorTx: { $exists: false }, commitHash: { $exists: true } })
    .sort({ lockedAt: 1 })
    .limit(256)
    .lean();
  if (picks.length === 0) return { anchored: 0 };

  const leaves = picks.map((p) => p.commitHash);
  const root = merkleRoot(leaves);
  // Placeholder tx id until viem broadcast is configured.
  const anchorTx =
    config.ANCHOR_PRIVATE_KEY && config.ANCHOR_RPC_URL
      ? `pending:${root.slice(0, 16)}`
      : `local:${root.slice(0, 16)}`;

  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i]!;
    await PickModel.updateOne(
      { _id: pick._id },
      { $set: { anchorTx, merkleRoot: root, merkleProof: merkleProof(leaves, i) } },
    );
  }

  await JobRun.create({ job: 'anchor', finishedAt: now, ok: true, detail: { count: picks.length, root } });
  return { anchored: picks.length, root, anchorTx };
}
