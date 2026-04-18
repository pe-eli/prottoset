import { Request, Response } from 'express';
import { leadsService } from '../modules/leads/leads.service';
import { leadSearchSchema, leadStatusUpdateSchema, uuidParamSchema } from '../validation/request.schemas';
import { subscriptionService } from '../modules/subscriptions/subscription.service';
import { quotaRepository } from '../security/quota.repository';

export const leadsController = {
  async getSearchQuota(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(401).json({ error: 'Não autenticado' });
        return;
      }

      const state = await subscriptionService.resolveAccessState(tenantId);
      const hasActiveSubscription = state.isActive;

      if (hasActiveSubscription) {
        res.json({
          hasActiveSubscription: true,
          dailyLeadsQuota: {
            key: 'free_leads_daily',
            limit: null,
            used: 0,
            remaining: null,
            applied: false,
          },
        });
        return;
      }

      const [limit, used] = await Promise.all([
        quotaRepository.resolveLimit(tenantId, 'free_leads_daily'),
        quotaRepository.getUsage(tenantId, 'free_leads_daily'),
      ]);

      res.json({
        hasActiveSubscription: false,
        dailyLeadsQuota: {
          key: 'free_leads_daily',
          limit,
          used,
          remaining: Math.max(0, limit - used),
          applied: true,
        },
      });
    } catch (err: any) {
      console.error('[Leads] getSearchQuota error:', err.message);
      res.status(500).json({ error: 'Erro ao consultar limite diário de leads' });
    }
  },

  async search(req: Request, res: Response): Promise<void> {
    const locals = res.locals as { freeTierLeadsReservedCost?: number };
    const releaseFreeTierReservation = async (amount: number): Promise<void> => {
      const normalizedAmount = Math.max(0, Math.floor(amount));
      if (normalizedAmount <= 0) return;

      const tenantId = req.tenantId;
      if (!tenantId) return;

      await quotaRepository.releaseAtomic(tenantId, 'free_leads_daily', normalizedAmount);
    };

    try {
      const tenantId = req.tenantId!;
      const parsed = leadSearchSchema.safeParse(req.body);
      if (!parsed.success) {
        await releaseFreeTierReservation(locals.freeTierLeadsReservedCost ?? 0);
        locals.freeTierLeadsReservedCost = undefined;
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
      }

      const safeMaxResults = parsed.data.maxResults ?? 50;
      const result = await leadsService.search(tenantId, {
        searchTerm: parsed.data.searchTerm,
        city: parsed.data.city,
        maxResults: safeMaxResults,
      });

      const reservedCost = locals.freeTierLeadsReservedCost ?? 0;
      if (reservedCost > 0) {
        const delivered = Math.max(0, Math.min(reservedCost, result.saved.length));
        const refund = reservedCost - delivered;
        if (refund > 0) {
          await releaseFreeTierReservation(refund);
        }
        locals.freeTierLeadsReservedCost = undefined;
      }

      res.json(result);
    } catch (err: any) {
      try {
        const reservedCost = locals.freeTierLeadsReservedCost ?? 0;
        if (reservedCost > 0) {
          await releaseFreeTierReservation(reservedCost);
          locals.freeTierLeadsReservedCost = undefined;
        }
      } catch (refundErr: any) {
        console.error('[Leads] search refund error:', refundErr.message);
      }

      console.error('[Leads] search error:', err.message);
      res.status(500).json({ error: 'Erro ao buscar leads' });
    }
  },

  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const leads = await leadsService.getAll(req.tenantId!);
      res.json(leads);
    } catch (err: any) {
      console.error('[Leads] getAll error:', err.message);
      res.status(500).json({ error: 'Erro ao listar leads' });
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const parsed = uuidParamSchema.safeParse(req.params);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
      }
      const lead = await leadsService.getById(req.tenantId!, parsed.data.id);
      if (!lead) {
        res.status(404).json({ error: 'Lead not found' });
        return;
      }
      res.json(lead);
    } catch (err: any) {
      console.error('[Leads] getById error:', err.message);
      res.status(500).json({ error: 'Erro ao buscar lead' });
    }
  },

  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const paramsParsed = uuidParamSchema.safeParse(req.params);
      if (!paramsParsed.success) {
        res.status(400).json({ error: paramsParsed.error.issues[0].message });
        return;
      }
      const bodyParsed = leadStatusUpdateSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        res.status(400).json({ error: bodyParsed.error.issues[0].message });
        return;
      }

      const lead = await leadsService.updateStatus(req.tenantId!, paramsParsed.data.id, bodyParsed.data.status);
      if (!lead) {
        res.status(404).json({ error: 'Lead not found' });
        return;
      }

      res.json(lead);
    } catch (err: any) {
      console.error('[Leads] updateStatus error:', err.message);
      res.status(500).json({ error: 'Erro ao atualizar lead' });
    }
  },

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const parsed = uuidParamSchema.safeParse(req.params);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0].message });
        return;
      }
      const deleted = await leadsService.delete(req.tenantId!, parsed.data.id);
      if (!deleted) {
        res.status(404).json({ error: 'Lead not found' });
        return;
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Leads] delete error:', err.message);
      res.status(500).json({ error: 'Erro ao excluir lead' });
    }
  },
};
