import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { originSocket } from '../realtime/emitter.js';
import { idParam } from './schemas.js';
import { workspacesRouter } from './workspaces/workspaces.routes.js';
import { boardsRouter } from './boards/boards.routes.js';
import { columnsRouter } from './columns/columns.routes.js';
import { cardsRouter } from './cards/cards.routes.js';
import { deleteLabel } from './boards/boards.service.js';
import { deleteComment } from './cards/cards.service.js';

export const apiRouter = Router();

apiRouter.use(requireAuth);
apiRouter.use('/workspaces', workspacesRouter);
apiRouter.use('/boards', boardsRouter);
apiRouter.use('/columns', columnsRouter);
apiRouter.use('/cards', cardsRouter);

apiRouter.delete('/labels/:id', validate({ params: idParam }), async (req, res) => {
  await deleteLabel(req.valid.params.id, req.user.id, originSocket(req));
  res.status(204).end();
});

apiRouter.delete('/comments/:id', validate({ params: idParam }), async (req, res) => {
  await deleteComment(req.valid.params.id, req.user.id, originSocket(req));
  res.status(204).end();
});
