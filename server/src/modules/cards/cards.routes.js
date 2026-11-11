import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { originSocket } from '../../realtime/emitter.js';
import { idParam } from '../schemas.js';
import { commentSchema, moveCardSchema, updateCardSchema } from './cards.schemas.js';
import * as service from './cards.service.js';

export const cardsRouter = Router();

cardsRouter.get('/:id', validate({ params: idParam }), async (req, res) => {
  res.json({ card: await service.getDetail(req.valid.params.id, req.user.id) });
});

cardsRouter.patch(
  '/:id',
  validate({ params: idParam, body: updateCardSchema }),
  async (req, res) => {
    const card = await service.update(
      req.valid.params.id,
      req.user.id,
      req.valid.body,
      originSocket(req),
    );
    res.json({ card });
  },
);

cardsRouter.patch(
  '/:id/move',
  validate({ params: idParam, body: moveCardSchema }),
  async (req, res) => {
    res.json(
      await service.move(req.valid.params.id, req.user.id, req.valid.body, originSocket(req)),
    );
  },
);

cardsRouter.delete('/:id', validate({ params: idParam }), async (req, res) => {
  await service.remove(req.valid.params.id, req.user.id, originSocket(req));
  res.status(204).end();
});

cardsRouter.post(
  '/:id/comments',
  validate({ params: idParam, body: commentSchema }),
  async (req, res) => {
    const comment = await service.addComment(
      req.valid.params.id,
      req.user.id,
      req.valid.body,
      originSocket(req),
    );
    res.status(201).json({ comment });
  },
);
