# Chat Toolzz - Desafio Técnico

Este é um projeto de chat em tempo real desenvolvido como um desafio técnico. Ele consiste em um backend construído com Node.js, Express, TypeScript, Socket.IO e Docker, e um frontend desenvolvido com Next.js, React, TypeScript, Shadcn UI e Tailwind CSS.

## Estrutura do Monorepo

O projeto está organizado em um monorepo com as seguintes pastas principais:

-   `/backend`: Contém o código-fonte do servidor da aplicação.
-   `/frontend`: Contém o código-fonte da interface do usuário.

## Backend

O backend é responsável por gerenciar as conexões de usuários, o armazenamento e a entrega de mensagens em tempo real, além de fornecer uma API para funcionalidades adicionais.

### Arquitetura

-   **Node.js com Express.js:** Para a criação do servidor HTTP e gerenciamento de rotas.
-   **TypeScript:** Para tipagem estática e melhor manutenibilidade do código.
-   **Socket.IO:** Para comunicação bidirecional em tempo real entre o cliente e o servidor.
-   **Redis (via BullMQ e ioredis):** Utilizado como message broker para filas de processamento assíncrono e possivelmente para caching.
-   **Supabase:** Como solução de banco de dados PostgreSQL e autenticação.
-   **Elasticsearch:** Para funcionalidades de busca avançada.
-   **Pino:** Para logging estruturado e eficiente.
-   **Helmet:** Para adicionar cabeçalhos de segurança HTTP.
-   **Swagger:** Para documentação da API.
-   **Docker:** Para containerização do backend, Redis, Elasticsearch e Cloudflare Tunnel.

### Variáveis de Ambiente

O backend utiliza um arquivo `.env.local` na raiz da pasta `backend/` para configurar as variáveis de ambiente. As seguintes variáveis são tipicamente necessárias:

```
# Configurações do Supabase
SUPABASE_URL=SUA_SUPABASE_URL
SUPABASE_KEY=SUA_SUPABASE_ANON_KEY
```

**Nota:** Adapte os valores conforme a sua configuração local ou de produção.

### Setup e Execução

1.  **Navegue até a pasta do backend:**
    ```bash
    cd backend
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Crie e configure o arquivo `.env.local`** com as variáveis de ambiente necessárias (veja a seção anterior).

4. **Para subir o docker:**
    ```bash
    docker-compose up --build
    ```  

5.  **Para rodar os testes:**
    ```bash
    npm test
    ```

### Documentação da API

A documentação da API (Swagger) estará disponível em `/api-docs` quando o servidor backend estiver rodando (ex: `http://localhost:3001/api-docs`).

## Frontend

O frontend é construído com Next.js e React, responsável pela interface do usuário e interação com o backend.

### Arquitetura

-   **Next.js:** Framework React para renderização no servidor (SSR), geração de sites estáticos (SSG) e funcionalidades de frontend modernas.
-   **React:** Biblioteca para construção de interfaces de usuário.
-   **TypeScript:** Para tipagem estática.
-   **Socket.IO Client:** Para comunicação em tempo real com o backend.
-   **Tailwind CSS:** Framework CSS utility-first para estilização rápida.
-   **Shadcn/ui (inferido):** Componentes de UI.
-   **Clerk:** Para autenticação e gerenciamento de usuários.
-   **next-intl:** Para internacionalização (i18n).


### Variáveis de Ambiente

O frontend pode requerer variáveis de ambiente, prefixadas com `NEXT_PUBLIC_`. Um exemplo comum é a URL da API do backend:

Crie um arquivo `.env.local` na raiz da pasta `frontend/`:

```
NEXT_PUBLIC_API_URL=http://localhost:3001 # URL do backend
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=SUA_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY=SEU_CLERK_SECRET_KEY
```

**Nota:** Adapte os valores conforme a sua configuração.

### Setup e Execução

1.  **Navegue até a pasta do frontend:**
    ```bash
    cd frontend
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Crie e configure o arquivo `.env.local`** com as variáveis de ambiente necessárias (veja a seção anterior).

4.  **Para desenvolvimento:**
    ```bash
    npm run dev
    ```
    O servidor de desenvolvimento Next.js iniciará, geralmente na porta 3000.

5.  **Para build de produção:**
    ```bash
    npm run build
    ```

6.  **Para iniciar em modo de produção (após o build):**
    ```bash
    npm run start
    ```

7.  **Para rodar o linter:**
    ```bash
    npm run lint
    ```

8.  **Para rodar os testes:**
    ```bash
    npm test
    ```

## Comunicação entre Backend e Frontend

-   **API RESTful:** O frontend consome a API exposta pelo backend (via Express) para operações e funcionalidades que não exigem tempo real.
-   **WebSockets (Socket.IO):** Para funcionalidades de chat em tempo real, como envio e recebimento de mensagens, notificações de digitação do usuário, etc. O frontend estabelece uma conexão Socket.IO com o servidor backend.

## Docker

O backend inclui um `Dockerfile` e um arquivo `docker-compose.yml` para facilitar a containerização da aplicação e seus serviços (Redis, Elasticsearch e Cloudflare Tunnel).

### Para rodar com Docker (Backend):

1.  Certifique-se de ter o Docker e Docker Compose instalados.
2.  Navegue até a pasta `backend/`.
3.  Configure as variáveis de ambiente no `.env.local` ou diretamente no `docker-compose.yml` se preferir.
4.  Execute o comando:
    ```bash
    docker-compose up --build
    ```
    Isso construirá as imagens (se necessário) e iniciará os contêineres definidos no `docker-compose.yml`.

---