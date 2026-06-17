# 🍼 E-commerce Mini Closet (Next.js + Supabase + Asaas + Resend)

Este repositório contém a aplicação completa do e-commerce premium **Mini Closet**, focada na venda e curadoria de moda infantil. A arquitetura foi desenhada para ser rápida, responsiva (mobile-first) e permitir o cadastro prático de produtos tirando foto diretamente da câmera do celular.

---

## 🛠️ Stack Tecnológica

- **Frontend & Server API:** [Next.js](https://nextjs.org/) (App Router, TypeScript)
- **Estilização:** [Tailwind CSS v4](https://tailwindcss.com/) (Estilos fluidos e modernos)
- **Banco de Dados & Storage:** [Supabase](https://supabase.com/) (PostgreSQL + RLS + Object Storage)
- **Gateway de Pagamento:** [Asaas](https://www.asaas.com/) (Geração de Pix copia-e-cola/QR Code e Cartão de Crédito)
- **Integração de Frete:** [Melhor Envio](https://melhorenvio.com.br/) (Cálculo dinâmico de prazos e taxas)
- **Notificações por E-mail:** [Resend](https://resend.com/) (E-mails transacionais para pedidos e pagamentos)

---

## 📐 Arquitetura da Aplicação

### 1. Banco de Dados (Supabase PostgreSQL)
O banco conta com as tabelas fundamentais configuradas em [supabase_schema.sql](supabase_schema.sql):
- **`produtos`**: Nome, descrição, preço de venda, preço de custo, tamanhos, imagens, peso/dimensões de envio e categoria.
- **`pedidos`**: Dados de entrega, totais de compra, status (`aguardando_pagamento`, `pago`, `preparando`, `enviado`, `entregue`, `cancelado`), forma de pagamento, parcelas e código de rastreamento.
- **`itens_pedido`**: Vincula os produtos vendidos aos pedidos, salvando preços históricos de custo e venda no momento da transação.

### 2. Políticas de Segurança (Row Level Security - RLS)
- **Público (Anônimo):** Permite listar produtos ativos e criar/visualizar pedidos por ID UUID (difícil adivinhação).
- **Admin (Autenticado):** Permite gerenciamento total dos produtos (inserção, edição, exclusão) e atualização/visualização completa de pedidos e clientes.

### 3. Bucket de Imagens
- Bucket chamado `fotos-produtos` configurado para armazenar as fotos enviadas. A leitura é pública e o upload é restrito ao administrador autenticado.

### 4. Compressão Inteligente de Imagens (Canvas/WebP)
Para permitir o cadastro rápido via celular 3G/4G, as fotos tiradas pela câmera são processadas no navegador do cliente (via HTML5 Canvas) antes do upload:
- Converte qualquer imagem (PNG/JPG de ~8MB) para o formato **WebP**.
- Limita o tamanho máximo a 1000px de largura/altura.
- Reduz o peso final para cerca de **100KB** por imagem, economizando banda de internet e acelerando o carregamento da loja.

---

## 🔒 Variáveis de Ambiente (`.env.local`)

Crie um arquivo `.env.local` na raiz do projeto e configure as seguintes chaves:

```env
# 1. Supabase (Project Settings -> API no Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUz...

# 2. Asaas (Gateway de Pagamentos)
# Se deixado em branco, o site ativará o simulador automático de Pix e Cartão de crédito para testes.
ASAAS_API_KEY=
ASAAS_SANDBOX=true

# 3. Melhor Envio (Cálculo de Frete)
# Se deixado em branco, o site usará prazos e valores simulados de frete.
MELHOR_ENVIO_TOKEN=

# 4. Resend (Disparo de E-mails)
# Se deixado em branco, o conteúdo dos e-mails será exibido no console do terminal para debug local.
RESEND_API_KEY=
EMAIL_FROM=onboarding@resend.dev

# 5. URL da Loja (Usado para os links nos e-mails do Resend)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🚀 Como Executar o Projeto Localmente

### 1. Instalar as dependências
```bash
npm install
```

### 2. Executar o servidor de desenvolvimento
```bash
npm run dev
```
O projeto estará rodando localmente em [http://localhost:3000](http://localhost:3000).

### 3. Fazer o build de produção local
```bash
npm run build
```

---

## 🌐 Deploy na Vercel

O deploy é integrado diretamente ao GitHub. A cada `git push` no ramo `main`, a Vercel atualiza o site automaticamente no ar.

> [!IMPORTANT]
> **Ajuste de Compilação na Vercel:**
> Por padrão, a Vercel pode não auto-detectar o framework Next.js. Garanta que nas configurações do seu projeto na Vercel em **`Settings -> Build and Deployment -> Framework Preset`** esteja selecionado **`Next.js`** (e não *Other*).

---

## 📝 Credenciais de Acesso (Desenvolvimento)

Registradas localmente em [credentials.local](credentials.local) (git-ignored):
- **Painel Administrativo (`/admin`):**
  - **E-mail:** `p.gaioli@gmail.com`
  - **Senha:** `T@ggen@2026`
- **Banco de Dados (Supabase):**
  - Senha cadastrada anotada na documentação de desenvolvimento local.
