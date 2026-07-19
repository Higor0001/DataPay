-- =========================================================================
-- ESQUEMA DE BANCO DE DADOS POSTGRESQL - DATAPAY (SUPABASE)
-- Este arquivo configura a estrutura de tabelas, chaves estrangeiras e RLS
-- (Row Level Security) para integração total com o Supabase Auth.
-- =========================================================================

-- 1. TABELA DE RESERVA INTELIGENTE (Uma por usuário)
CREATE TABLE public.reserves (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    goal_value NUMERIC(12, 2) DEFAULT 700.00 NOT NULL,
    current_balance NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS para Reserves
ALTER TABLE public.reserves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem gerenciar suas próprias reservas" 
    ON public.reserves 
    FOR ALL 
    USING (auth.uid() = user_id);


-- 2. TABELA DE HISTÓRICO DE APORTES DA RESERVA
CREATE TABLE public.reserve_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('deposit', 'withdraw')) NOT NULL,
    description VARCHAR(255) NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS para Historico de Reserva
ALTER TABLE public.reserve_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem gerenciar seu histórico de reserva" 
    ON public.reserve_history 
    FOR ALL 
    USING (auth.uid() = user_id);


-- 3. TABELA DE CADASTRO DE DÍVIDAS
CREATE TABLE public.debts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    bank VARCHAR(100) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('Empréstimo', 'Financiamento', 'Cartão', 'Consignado', 'Parcelamento', 'Crediário', 'Negociação')) NOT NULL,
    original_value NUMERIC(12, 2) NOT NULL,
    current_balance NUMERIC(12, 2) NOT NULL,
    interest_rate NUMERIC(5, 2) NOT NULL, -- % ao mês
    cet NUMERIC(6, 2) NOT NULL, -- Custo Efetivo Total % ao ano
    iof NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    fine NUMERIC(5, 2) DEFAULT 2.00 NOT NULL, -- Multa em %
    delay_fee NUMERIC(5, 2) DEFAULT 1.00 NOT NULL, -- Mora em % ao mês
    contract_date DATE NOT NULL,
    due_date INT CHECK (due_date >= 1 AND due_date <= 31) NOT NULL,
    next_due_date DATE NOT NULL,
    total_installments INT NOT NULL,
    remaining_installments INT NOT NULL,
    installment_value NUMERIC(12, 2) NOT NULL,
    index_used VARCHAR(50) DEFAULT 'Taxa Fixa' NOT NULL,
    notes TEXT,
    status VARCHAR(20) CHECK (status IN ('active', 'negotiation', 'paid', 'overdue')) DEFAULT 'active' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS para Dívidas
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem gerenciar suas próprias dívidas" 
    ON public.debts 
    FOR ALL 
    USING (auth.uid() = user_id);


-- 4. TABELA DE COMPENSAÇÃO E HISTÓRICO DE PAGAMENTOS
CREATE TABLE public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    debt_id UUID REFERENCES public.debts(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,
    status VARCHAR(20) CHECK (status IN ('Pago', 'Pendente', 'Atrasado', 'Agendado')) DEFAULT 'Pendente' NOT NULL,
    method VARCHAR(50) CHECK (method IN ('Pix', 'Boleto', 'Reserva Inteligente', 'Automático')) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('Parcela', 'Amortização', 'Quitação')) DEFAULT 'Parcela' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS para Pagamentos
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem gerenciar seus próprios pagamentos" 
    ON public.payments 
    FOR ALL 
    USING (auth.uid() = user_id);


-- 5. TABELA DE METAS FINANCEIRAS
CREATE TABLE public.goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    target_value NUMERIC(12, 2) NOT NULL,
    current_value NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    type VARCHAR(50) CHECK (type IN ('quitar_cartao', 'quitar_emprestimo', 'eliminar_dividas', 'criar_reserva', 'fundo_emergencia')) NOT NULL,
    deadline DATE NOT NULL,
    accumulated_savings NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS para Metas
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem gerenciar suas próprias metas" 
    ON public.goals 
    FOR ALL 
    USING (auth.uid() = user_id);


-- 6. TABELA DE ALERTAS E NOTIFICAÇÕES
CREATE TABLE public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(150) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(20) CHECK (type IN ('info', 'warning', 'alert', 'success')) DEFAULT 'info' NOT NULL,
    read BOOLEAN DEFAULT FALSE NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS para Notificações
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem gerenciar suas próprias notificações" 
    ON public.notifications 
    FOR ALL 
    USING (auth.uid() = user_id);
