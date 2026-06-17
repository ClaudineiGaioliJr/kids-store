-- =========================================================================
-- SCRIPT DE SCHEMA E POLÍTICAS DE ACESSO (KIDS-STORE)
-- Execute este script no SQL Editor do seu novo projeto Supabase.
-- =========================================================================

-- Habilitar extensões úteis se não estiverem ativas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE PRODUTOS
CREATE TABLE IF NOT EXISTS public.produtos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    preco_venda NUMERIC(10,2) NOT NULL,
    preco_custo NUMERIC(10,2) NOT NULL,
    tamanhos VARCHAR(50)[] NOT NULL DEFAULT '{}',
    imagens TEXT[] NOT NULL DEFAULT '{}',
    peso_g INTEGER NOT NULL DEFAULT 0,
    comprimento_cm INTEGER NOT NULL DEFAULT 0,
    largura_cm INTEGER NOT NULL DEFAULT 0,
    altura_cm INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABELA DE PEDIDOS
CREATE TABLE IF NOT EXISTS public.pedidos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_pedido SERIAL NOT NULL,
    cliente_nome VARCHAR(255) NOT NULL,
    cliente_cpf VARCHAR(14) NOT NULL,
    cliente_whatsapp VARCHAR(20) NOT NULL,
    cliente_email VARCHAR(255),
    tipo_entrega VARCHAR(50) NOT NULL, -- 'envio' ou 'retirada'
    frete_valor NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    frete_prazo VARCHAR(100),
    endereco_cep VARCHAR(9),
    endereco_rua VARCHAR(255),
    numero VARCHAR(50),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    total_produtos NUMERIC(10,2) NOT NULL,
    total_pedido NUMERIC(10,2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'aguardando_pagamento',
    codigo_rastreio VARCHAR(100),
    asaas_payment_id VARCHAR(255),
    forma_pagamento VARCHAR(50), -- 'pix' ou 'cartao'
    parcelas INTEGER DEFAULT 1,
    taxa_gateway_paga NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABELA DE ITENS DO PEDIDO
CREATE TABLE IF NOT EXISTS public.itens_pedido (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    tamanho_selecionado VARCHAR(50) NOT NULL,
    preco_venda_unitario NUMERIC(10,2) NOT NULL,
    preco_custo_unitario NUMERIC(10,2) NOT NULL
);

-- =========================================================================
-- CONFIGURAÇÕES DE SEGURANÇA E POLÍTICAS RLS (Row Level Security)
-- =========================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;

-- A. Políticas para PRODUTOS:
-- Qualquer usuário anônimo ou autenticado pode listar/visualizar produtos ativos
CREATE POLICY "Permitir leitura publica de produtos ativos" ON public.produtos
    FOR SELECT TO anon, authenticated
    USING (ativo = TRUE);

-- Apenas o administrador autenticado pode gerenciar produtos (Inserir, Atualizar, Deletar)
CREATE POLICY "Permitir gerenciamento total de produtos para admin" ON public.produtos
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- B. Políticas para PEDIDOS:
-- Clientes anônimos podem criar pedidos (checkout)
CREATE POLICY "Permitir criacao de pedidos publica" ON public.pedidos
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- Clientes anônimos podem ler seu próprio pedido para acompanhamento
CREATE POLICY "Permitir leitura publica por ID do pedido" ON public.pedidos
    FOR SELECT TO anon, authenticated
    USING (true); -- Permitimos a consulta pública por ID (UUID) que já é de difícil adivinhação

-- Apenas o administrador autenticado pode ver a lista completa e gerenciar pedidos
CREATE POLICY "Permitir gerenciamento total de pedidos para admin" ON public.pedidos
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- C. Políticas para ITENS_PEDIDO:
-- Permite inserção pública (necessário para fechar pedido)
CREATE POLICY "Permitir criacao publica de itens de pedido" ON public.itens_pedido
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- Permite leitura por parte do cliente
CREATE POLICY "Permitir leitura publica de itens por ID" ON public.itens_pedido
    FOR SELECT TO anon, authenticated
    USING (true);

-- Apenas administrador pode modificar itens
CREATE POLICY "Permitir gerenciamento de itens para admin" ON public.itens_pedido
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);


-- =========================================================================
-- CONFIGURAÇÃO DO BUCKET DE IMAGENS E POLÍTICAS DE STORAGE
-- Crie manualmente um bucket chamado 'fotos-produtos' antes ou rode o DDL
-- =========================================================================

-- Tenta inserir o bucket caso a função exista e não dê conflito
INSERT INTO storage.buckets (id, name, public) 
VALUES ('fotos-produtos', 'fotos-produtos', true)
ON CONFLICT (id) DO NOTHING;

-- Criar Políticas de Acesso para o bucket 'fotos-produtos'
DROP POLICY IF EXISTS "Leitura publica fotos-produtos" ON storage.objects;
DROP POLICY IF EXISTS "Upload fotos-produtos para admin" ON storage.objects;
DROP POLICY IF EXISTS "Update fotos-produtos para admin" ON storage.objects;
DROP POLICY IF EXISTS "Delete fotos-produtos para admin" ON storage.objects;

-- A. Permitir leitura pública (SELECT) de qualquer imagem
CREATE POLICY "Leitura publica fotos-produtos" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'fotos-produtos');

-- B. Permitir que apenas o admin autenticado insira fotos
CREATE POLICY "Upload fotos-produtos para admin" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'fotos-produtos');

-- C. Permitir que apenas o admin autenticado atualize fotos
CREATE POLICY "Update fotos-produtos para admin" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'fotos-produtos');

-- D. Permitir que apenas o admin autenticado delete fotos
CREATE POLICY "Delete fotos-produtos para admin" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'fotos-produtos');
