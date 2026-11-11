import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { originSocket } from '../../realtime/emitter.js';
import { idParam } from '../schemas.js';
import * as service from './columns.service.js';
import * as cardsService from '../cards/cards.service.js';
import { createCardSchema } from '../cards/cards.schemas.js';
import { updateColumnSchema } from './columns.schemas.js';

export const columnsRouter = Router();

columnsRouter.patch(
  '/:id',
  validate({ params: idParam, body: updateColumnSchema }),
  async (req, res) => {
    const column = await service.update(
      req.valid.params.id,
      req.user.id,
      req.valid.body,
      originSocket(req),
    );
    res.json({ column });
  },
);

columnsRouter.patch(
  '/:id/move',
  validate({ params: idParam, body: z.object({ index: z.number().int().min(0) }) }),
  async (req, res) => {
    res.json(
      await service.move(req.valid.params.id, req.user.id, req.valid.body, originSocket(req)),
    );
  },
);

columnsRouter.delete('/:id', validate({ params: idParam }), async (req, res) => {
  await service.remove(req.valid.params.id, req.user.id, originSocket(req));
  res.status(204).end();
});

columnsRouter.post(
  '/:id/cards',
  validate({ params: idParam, body: createCardSchema }),
  async (req, res) => {
    const card = await cardsService.create(
      req.valid.params.id,
      req.user.id,
      req.valid.body,
      originSocket(req),
    );
    res.status(201).json({ card });
  },
);
