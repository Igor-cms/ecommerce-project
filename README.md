# E-commerce project 

Loja online de café especial (specialty coffee): catálogo, carrinho, conta de cliente, canal atacado (wholesale) e painel administrativo. O frontend é uma SPA em React; checkout, produtos, pedidos e clientes passam por **Shopify**; autenticação, banco e Edge Functions ficam no **Supabase**. Integrações extras cobrem Stripe, FedEx, Xero e webhooks.

## O que o projeto faz

- **Vitrine e catálogo** — listagem de cafés, página de produto (galeria, notas de sabor, elevação), favoritos e SEO.
- **Carrinho e checkout** — carrinho persistente, códigos de desconto, sample pack, redirecionamento para checkout Shopify e página de sucesso.
- **Conta** — cadastro, login, recuperação de senha, pedidos do cliente e dados da conta.
- **Wholesale** — loja B2B, cadastro, MOQ, coleta de VAT e fluxo de aprovação.
- **Admin** — gestão de produtos, clientes, cupons, pedidos, inventário, lista de torra, páginas visíveis e faturamento.
- **Operações** — webhooks de pedido Shopify, estoque, etiquetas FedEx, faturas Xero e e-mails transacionais via Edge Functions.

Rotas principais: `/` (hero no desktop; no mobile redireciona para o catálogo), `/coffee` e `/shop`, `/product/:id`, `/cart`, `/login`, `/register`, `/account`, `/my-orders`, `/wholesale`, `/about`, `/manage` e `/admin/*`.

## Tecnologias

| Camada | Stack |
|--------|--------|
| UI | React 18, TypeScript, Vite 5, React Router 6 |
| Estilo | Tailwind CSS, shadcn/ui (Radix), Lucide |
| Estado / dados | TanStack Query, contextos de auth e carrinho |
| Formulários | React Hook Form, Zod |
| Backend | Supabase (Auth, Postgres, Edge Functions em Deno) |
| Comércio | Shopify Admin/Storefront (via functions) |
| Pagamentos / envio / contábil | Stripe, FedEx, Xero |
| Deploy | Vercel (`vercel.json` com SPA rewrite) |

Scripts npm: `dev` (Vite na porta **8080**), `build`, `build:dev`, `lint`, `preview`.

## Requisitos

- Node.js 18+ (recomendado 20+)
- npm (há também `bun.lock` se preferir Bun)
- Conta [Supabase](https://supabase.com) e CLI opcional (`npx supabase`) para functions e migrations
- Loja Shopify e chaves das integrações que for usar (Stripe, FedEx, Xero, etc.)

## Instalação e execução

```sh
git clone https://github.com/Igor-cms/Ecommerce-project.git
cd Ecommerce-project
npm install
```

Crie um arquivo `.env` na raiz (não versione esse arquivo). Variáveis usadas pelo frontend:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
```

Secrets de Shopify, Stripe, FedEx, Xero e webhooks ficam nas **Edge Functions / secrets do Supabase**, não no cliente.

Suba o app local:

```sh
npm run dev
```

Abra [http://localhost:8080](http://localhost:8080).

Build de produção:

```sh
npm run build
npm run preview
```

### Supabase (backend)

Migrations em `supabase/migrations/`. Functions em `supabase/functions/` (produtos, pedidos, descontos, checkout, webhooks, wholesale, e-mail, FedEx, Xero, etc.).

Com a [Supabase CLI](https://supabase.com/docs/guides/cli):

```sh
npx supabase start          # stack local (Docker)
npx supabase functions serve
npx supabase db push        # aplicar migrations no projeto remoto
```

## Estrutura do repositório

```
src/
  pages/           # Rotas (catálogo, produto, auth, admin, wholesale)
  components/      # UI da loja, admin, wholesale e shadcn
  contexts/        # Auth e carrinho
  hooks/           # Shopify, pedidos, estoque, SEO, etc.
  integrations/    # Cliente e tipos do Supabase
  config/          # Marca e animações do hero
  data/            # Dados estáticos (produtos em destaque, etc.)
supabase/
  functions/       # Edge Functions
  migrations/      # SQL
public/            # Assets, sitemap, documentos
```

## Observações

- Rotas admin exigem usuário autenticado com papel de administrador no Supabase.
- Visibilidade de algumas páginas (`shop`, `about`, login, etc.) pode ser controlada no painel (`/admin/pages`).
- Nunca commite `.env` nem chaves de API.
