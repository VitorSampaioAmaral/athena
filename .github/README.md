# GitHub Actions Configuration

Este diretório contém os workflows do GitHub Actions para o projeto Athena.

## Configuração

### Variáveis de Ambiente Necessárias

Para que o build funcione corretamente, você precisa configurar as seguintes variáveis de ambiente no seu repositório GitHub:

1. Vá para **Settings** > **Secrets and variables** > **Actions**
2. Adicione as seguintes variáveis:

#### Obrigatórias:
- `DATABASE_URL`: URL de conexão com o banco de dados PostgreSQL
- `NEXTAUTH_SECRET`: Chave secreta para o NextAuth (mínimo 32 caracteres)
- `NEXTAUTH_URL`: URL da aplicação (ex: https://seu-dominio.com)

#### Opcionais:
- `OPENROUTER_API_KEY`: Chave da API do OpenRouter para análise de imagens
- `SECURITY_HEADERS_ENABLED`: Habilitar headers de segurança (true/false)
- `RATE_LIMIT_ENABLED`: Habilitar rate limiting (true/false)
- `SECURITY_LOGGING_ENABLED`: Habilitar logging de segurança (true/false)

### Exemplo de configuração:

```bash
DATABASE_URL=postgresql://username:password@host:5432/database
NEXTAUTH_SECRET=your-super-secret-key-here-minimum-32-characters-long
NEXTAUTH_URL=https://your-domain.com
OPENROUTER_API_KEY=your-openrouter-api-key
SECURITY_HEADERS_ENABLED=true
RATE_LIMIT_ENABLED=true
SECURITY_LOGGING_ENABLED=true
```

## Workflows Disponíveis

### build.yml
- Executa em pushes para `main`/`master` e pull requests
- Instala dependências
- Gera cliente Prisma
- Executa linting
- Faz build da aplicação
- Faz upload dos artefatos de build

## Solução de Problemas

### Erro: "Module not found"
Se você encontrar erros de módulos não encontrados, verifique:

1. Se todas as dependências estão instaladas corretamente
2. Se os caminhos de importação estão corretos
3. Se o `tsconfig.json` está configurado adequadamente
4. Se o `next.config.js` tem os aliases corretos

### Erro: "Build failed"
1. Verifique se todas as variáveis de ambiente estão configuradas
2. Execute `npm run build:clean` localmente para testar
3. Verifique os logs do GitHub Actions para mais detalhes 