import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId') || 'default_user';
    const { db } = await connectToDatabase();

    // Busca as coleções associadas ao usuário
    const debts = await db.collection('debts').find({ userId }).toArray();
    const payments = await db.collection('payments').find({ userId }).toArray();
    const reserve = await db.collection('reserves').findOne({ userId });
    const goals = await db.collection('goals').find({ userId }).toArray();
    const notifications = await db.collection('notifications').find({ userId }).toArray();

    return NextResponse.json({
      success: true,
      data: {
        debts: debts.map(d => {
          const { _id, userId: _, ...rest } = d;
          return { ...rest };
        }),
        payments: payments.map(p => {
          const { _id, userId: _, ...rest } = p;
          return { ...rest };
        }),
        reserve: reserve ? {
          goalValue: reserve.goalValue,
          currentBalance: reserve.currentBalance,
          history: reserve.history || []
        } : { goalValue: 0, currentBalance: 0, history: [] },
        goals: goals.map(g => {
          const { _id, userId: _, ...rest } = g;
          return { ...rest };
        }),
        notifications: notifications.map(n => {
          const { _id, userId: _, ...rest } = n;
          return { ...rest };
        })
      }
    });
  } catch (error: any) {
    console.error('[MongoDB Load Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, debts, payments, reserve, goals, notifications } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // 1. Sincroniza Dívidas
    if (Array.isArray(debts)) {
      await db.collection('debts').deleteMany({ userId });
      if (debts.length > 0) {
        await db.collection('debts').insertMany(debts.map(d => ({ ...d, userId })));
      }
    }

    // 2. Sincroniza Pagamentos
    if (Array.isArray(payments)) {
      await db.collection('payments').deleteMany({ userId });
      if (payments.length > 0) {
        await db.collection('payments').insertMany(payments.map(p => ({ ...p, userId })));
      }
    }

    // 3. Sincroniza Reserva
    if (reserve) {
      await db.collection('reserves').updateOne(
        { userId },
        { 
          $set: { 
            goalValue: reserve.goalValue, 
            currentBalance: reserve.currentBalance, 
            history: reserve.history || [], 
            updatedAt: new Date().toISOString() 
          } 
        },
        { upsert: true }
      );
    }

    // 4. Sincroniza Metas (Goals)
    if (Array.isArray(goals)) {
      await db.collection('goals').deleteMany({ userId });
      if (goals.length > 0) {
        await db.collection('goals').insertMany(goals.map(g => ({ ...g, userId })));
      }
    }

    // 5. Sincroniza Notificações
    if (Array.isArray(notifications)) {
      await db.collection('notifications').deleteMany({ userId });
      if (notifications.length > 0) {
        await db.collection('notifications').insertMany(notifications.map(n => ({ ...n, userId })));
      }
    }

    return NextResponse.json({ success: true, message: 'MongoDB Sync Completed' });
  } catch (error: any) {
    console.error('[MongoDB Save Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
