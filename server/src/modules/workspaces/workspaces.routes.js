import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { idParam, role, uuid } from '../schemas.js';
import * as service from './workspaces.service.js';
import * as boardsService from '../boards/boards.service.js';
import { createBoardSchema } from '../boards/boards.schemas.js';

export const workspacesRouter = Router();

const nameSchema = z.object({ name: z.string().trim().min(1).max(80) });
const memberParams = z.object({ id: uuid, userId: uuid });

workspacesRouter.get('/', async (req, res) => {
  res.json({ workspaces: await service.listForUser(req.user.id) });
});

workspacesRouter.post('/', validate({ body: nameSchema }), async (req, res) => {
  res.status(201).json({ workspace: await service.create(req.user.id, req.valid.body) });
});

workspacesRouter.get('/:id', validate({ params: idParam }), async (req, res) => {
  res.json({ workspace: await service.getDetail(req.valid.params.id, req.user.id) });
});

workspacesRouter.patch(
  '/:id',
  validate({ params: idParam, body: nameSchema }),
  async (req, res) => {
    res.json({ workspace: await service.rename(req.valid.params.id, req.user.id, req.valid.body) });
  },
);

workspacesRouter.delete('/:id', validate({ params: idParam }), async (req, res) => {
  await service.remove(req.valid.params.id, req.user.id);
  res.status(204).end();
});

workspacesRouter.post(
  '/:id/members',
  validate({
    params: idParam,
    body: z.object({
      email: z.string().trim().toLowerCase().email(),
      role: role.default('member'),
    }),
  }),
  async (req, res) => {
    const member = await service.addMember(req.valid.params.id, req.user.id, req.valid.body);
    res.status(201).json({ member });
  },
);

workspacesRouter.patch(
  '/:id/members/:userId',
  validate({ params: memberParams, body: z.object({ role }) }),
  async (req, res) => {
    const { id, userId } = req.valid.params;
    res.json({ member: await service.updateMemberRole(id, req.user.id, userId, req.valid.body) });
  },
);

workspacesRouter.delete(
  '/:id/members/:userId',
  validate({ params: memberParams }),
  async (req, res) => {
    const { id, userId } = req.valid.params;
    await service.removeMember(id, req.user.id, userId);
    res.status(204).end();
  },
);

workspacesRouter.post(
  '/:id/boards',
  validate({ params: idParam, body: createBoardSchema }),
  async (req, res) => {
    const board = await boardsService.create(req.valid.params.id, req.user.id, req.valid.body);
    res.status(201).json({ board });
  },
);
