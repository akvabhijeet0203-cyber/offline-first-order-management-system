import { db } from '../db/db';
import { startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';

export const QueryService = {
  async getDueAndOverdue() {
    const today = new Date().toISOString().split('T')[0];
    const orders = await db.orders.filter(o => !o.deleted && o.status !== 'completed').toArray();
    return {
      dueToday: orders.filter(o => o.due_date && o.due_date.startsWith(today)),
      overdue: orders.filter(o => o.due_date && o.due_date.split('T')[0] < today)
    };
  },

  async getOutstandingBalances() {
    const unpaid = await db.orders.filter(o => !o.deleted && !o.is_paid && (o.amount ?? 0) > 0).toArray();
    const totalOwed = unpaid.reduce((sum, o) => sum + (o.amount || 0), 0);
    return { unpaid, totalOwed };
  },

  async getWeeklyCapacity() {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });

    const all = await db.orders.filter(o => !o.deleted && o.status !== 'cancelled').toArray();
    const thisWeekOrders = all.filter(o => {
      if (!o.due_date) return false;
      try {
        const d = parseISO(o.due_date);
        return isWithinInterval(d, { start, end });
      } catch {
        return false;
      }
    });

    const totalItems = thisWeekOrders.reduce((acc, o) => {
      return acc + (o.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0);
    }, 0);

    return { orderCount: thisWeekOrders.length, totalItems, orders: thisWeekOrders };
  }
};