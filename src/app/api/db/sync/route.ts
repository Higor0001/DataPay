import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId') || 'default_user';
    const { db } = await connectToDatabase();

    // Busca os dados financeiros consolidados do usuário na coleção 'Finanças'
    const financeData = await db.collection('Finanças').findOne({ userId });

    if (financeData) {
      return NextResponse.json({
        success: true,
        data: {
          debts: financeData.debts || [],
          payments: financeData.payments || [],
          reserve: financeData.reserve || { goalValue: 0, currentBalance: 0, history: [] },
          goals: financeData.goals || [],
          notifications: financeData.notifications || []
        }
      });
    }

    // Se o usuário não tiver dados salvos, retorna estrutura limpa padrão
    return NextResponse.json({
      success: true,
      data: {
        debts: [],
        payments: [],
        reserve: { goalValue: 0, currentBalance: 0, history: [] },
        goals: [],
        notifications: []
      }
    });
  } catch (error: any) {
    console.error('[MongoDB Finanças Load Error]:', error);
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

    // Salva ou atualiza a estrutura inteira de Finanças do usuário de forma atômica
    await db.collection('Finanças').updateOne(
      { userId },
      { 
        $set: { 
          userId,
          debts: debts || [],
          payments: payments || [],
          reserve: reserve || { goalValue: 0, currentBalance: 0, history: [] },
          goals: goals || [],
          notifications: notifications || [],
          updatedAt: new Date().toISOString()
        } 
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: 'Dados de Finanças atualizados no MongoDB' });
  } catch (error: any) {
    console.error('[MongoDB Finanças Save Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
