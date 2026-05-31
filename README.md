# Nexora Finance V2

Web app de agente financeiro pessoal feito em React + Vite.

Esta versão abre zerada, sem dados de exemplo. Cada pessoa cadastra o próprio nome, receitas, despesas, metas, limites, categorias e orçamentos.

## Como rodar no VS Code

1. Extraia o ZIP.
2. Abra a pasta `nexora-finance` no VS Code.
3. Abra o terminal dentro da pasta.
4. Rode:

```bash
npm install
npm run dev
```

Depois abra o link que aparecer no terminal.

## Funções incluídas

- Login local.
- Projeto inicia zerado para uso por qualquer pessoa.
- Dashboard financeiro.
- Cadastro de receitas e despesas.
- Edição de movimentações.
- Exclusão de movimentações.
- Filtro por mês e ano.
- Busca por nome ou categoria.
- Categorias personalizadas.
- Exclusão de categorias.
- Despesas fixas.
- Recorrência automática mensal.
- Orçamento por categoria.
- Agent em formato chat.
- Perguntas como: “posso gastar quanto hoje?”.
- Alertas de vencimento.
- Marcar conta como paga.
- Metas financeiras.
- Reserva de emergência.
- Planejador de quitação de dívidas.
- Exportar Excel.
- Backup JSON.
- Restaurar backup JSON.
- Relatório PDF.
- Tema claro/escuro.
- PWA para instalar no celular.

## Como instalar no celular

Depois de hospedar o projeto online, abra o site no Chrome do celular e toque em:

`Menu > Adicionar à tela inicial`

## Sobre banco de dados online

Esta versão salva no navegador usando LocalStorage. Isso é ótimo para testar e usar localmente.

Para banco online real, use Supabase ou Firebase. O caminho recomendado é:

1. Criar conta no Supabase.
2. Criar tabela `transactions`.
3. Criar tabela `categories`.
4. Ativar autenticação por e-mail.
5. Trocar as funções `loadData` e `setData` por chamadas ao Supabase.

Exemplo futuro:

```js
// npm install @supabase/supabase-js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('SUA_URL', 'SUA_CHAVE_PUBLICA')
```

## Publicar online

Recomendado: Vercel.

1. Envie o projeto para o GitHub.
2. Entre em https://vercel.com.
3. Clique em Add New Project.
4. Importe o repositório.
5. Clique em Deploy.

## Observação

O login desta versão é local. Ele não cria conta real em servidor. Para múltiplos usuários e sincronização entre dispositivos, precisa ativar Supabase/Firebase.

## Relatórios empresariais

Esta versão inclui exportação profissional para PDF e Excel:

- PDF com cabeçalho Nexora Finance, resumo executivo, indicadores principais, análises do Agent, gastos por categoria, movimentações do mês, rodapé e área de conferência/assinatura.
- Excel com abas separadas: Resumo Executivo, Movimentações, Categorias, Agent Insights e Leia-me.
- Nomes de arquivo padronizados por competência: `nexora-finance-relatorio-AAAA-MM.pdf` e `.xlsx`.

Esses relatórios foram pensados para apresentação profissional, conferência interna e uso por pessoas que queiram uma aparência mais empresarial.
