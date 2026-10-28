import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { settleSlip, slipClv } from '../core/settlement.js';
import type { Leg, LegResult } from '../core/types.js';
import { HttpError } from '../errors.js';
import { requireAdmin, requireUser } from '../middleware/auth.js';
import { PickModel, SpottedSlip } from '../models/index.js';

const SettleLeg = z
  .object({
    pickId: z.string().optional(),
    spottedSlipId: z.string().optional(),
    legIndex: z.number().int().min(0),
    result: z.enum(['won', 'lost', 'void']),
  })
  .refine((v) => Boolean(v.pickId) !== Boolean(v.spottedSlipId), {
    message: 'Send exactly one of pickId or spottedSlipId',
  });

export function adminRouter() {
  const r = Router();

  /** Manually settle one leg (markets the results provider can't map). */
  r.post('/admin/legs/settle', requireUser, requireAdmin, async (req, res) => {
    const body = SettleLeg.parse(req.body);

    if (body.pickId) {
      if (!Types.ObjectId.isValid(body.pickId)) throw new HttpError(404, 'Pick not found');
      const pick = await PickModel.findById(body.pickId);
      if (!pick) throw new HttpError(404, 'Pick not found');
      const legs = [...(pick.legs as unknown as Leg[])];
      if (body.legIndex >= legs.length) throw new HttpError(400, 'legIndex out of range');
      legs[body.legIndex] = { ...legs[body.legIndex]!, result: body.result as LegResult };
      const settled = settleSlip(legs, pick.stakeUnits);
      pick.set('legs', legs);
      if (settled.result !== 'pending') {
        pick.result = settled.result;
        pick.profitUnits = settled.profitUnits;
        pick.clv = slipClv(legs);
        pick.settledAt = new Date();
        pick.revealed = true;
      }
      await pick.save();
      return res.json({ ok: true, result: pick.result, legs: pick.legs });
    }

    if (!Types.ObjectId.isValid(body.spottedSlipId!)) throw new HttpError(404, 'Spotted slip not found');
    const spotted = await SpottedSlip.findById(body.spottedSlipId);
    if (!spotted) throw new HttpError(404, 'Spotted slip not found');
    const legs = [...(spotted.slip.legs as unknown as Leg[])];
    if (body.legIndex >= legs.length) throw new HttpError(400, 'legIndex out of range');
    legs[body.legIndex] = { ...legs[body.legIndex]!, result: body.result as LegResult };
    const settled = settleSlip(legs, 1);
    spotted.set('slip.legs', legs);
    if (settled.result !== 'pending') {
      spotted.result = settled.result;
      spotted.settledAt = new Date();
    }
    await spotted.save();
    res.json({ ok: true, result: spotted.result, legs: spotted.slip.legs });
  });

  return r;
}
