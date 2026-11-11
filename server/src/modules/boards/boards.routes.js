import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { assertBoardAccess } from '../../services/access.js';
import { listActivity } from '../../services/activity.js';
import { originSocket } from '../../realtime/emitter.js';
import { idParam } from '../schemas.js';
import { activityQuery, labelSchema, updateBoardSchema } from './boards.schemas.js';
import * as service from './boards.service.js';
import * as columnsService from '../columns/columns.service.js';
import { createColumnSchema } from '../columns/columns.schemas.js';

export const boardsRouter = Router();

boardsRouter.get('/:id', validate({ params: idParam }), async (req, res) => {
  res.json(await service.getFull(req.valid.params.id, req.user.id));
});

boardsRouter.patch(
  '/:id',
  validate({ params: idParam, body: updateBoardSchema }),
  async (req, res) => {
    const board = await service.update(
      req.valid.params.id,
      req.user.id,
      req.valid.body,
      originSocket(req),
    );
    res.json({ board });
  },
);

boardsRouter.delete('/:id', validate({ params: idParam }), async (req, res) => {
  await service.remove(req.valid.params.id, req.user.id);
  res.status(204).end();
});

boardsRouter.get(
  '/:id/activity',
  validate({ params: idParam, query: activityQuery }),
  async (req, res) => {
    await assertBoardAccess(req.valid.params.id, req.user.id);
    res.json({ activities: await listActivity(req.valid.params.id, req.valid.query) });
  },
);

boardsRouter.post(
  '/:id/labels',
  validate({ params: idParam, body: labelSchema }),
  async (req, res) => {
    const label = await service.createLabel(
      req.valid.params.id,
      req.user.id,
      req.valid.body,
      originSocket(req),
    );
    res.status(201).json({ label });
  },
);

boardsRouter.post(
  '/:id/columns',
  validate({ params: idParam, body: createColumnSchema }),
  async (req, res) => {
    const column = await columnsService.create(
      req.valid.params.id,
      req.user.id,
      req.valid.body,
      originSocket(req),
    );
    res.status(201).json({ column });
  },
);
