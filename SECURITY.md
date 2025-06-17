# Segurança do Athena

Este documento descreve as medidas de segurança implementadas no projeto Athena.

## 🔒 Medidas de Segurança Implementadas

### 1. Autenticação e Autorização

#### NextAuth.js com JWT
- **Estratégia**: JWT (JSON Web Tokens)
- **Duração da sessão**: 24 horas
- **Cookies**: HTTP-Only, SameSite=Lax, Secure em produção
- **Proteção CSRF**: Automática via NextAuth

#### Hash de Senhas
- **Algoritmo**: bcrypt
- **Salt rounds**: 12 (muito seguro)
- **Comparação**: Segura contra timing attacks

### 2. Rate Limiting

#### Proteção contra Ataques de Força Bruta
- **Login**: 5 tentativas em 15 minutos
- **Registro**: 3 tentativas em 1 hora
- **API geral**: 100 requisições por minuto

#### Implementação
- Armazenamento em memória (desenvolvimento)
- Recomendado: Redis para produção
- Headers de resposta informativos

### 3. Validação de Entrada

#### Validação de Email
- Regex robusto RFC 5322
- Verificação de comprimento (máx. 254 caracteres)
- Sanitização automática

#### Validação de Senha
- Mínimo 8 caracteres
- Máximo 128 caracteres
- Letras maiúsculas e minúsculas
- Números obrigatórios
- Caracteres especiais obrigatórios

#### Validação de Nome
- Mínimo 2 caracteres
- Máximo 100 caracteres
- Apenas letras, espaços e caracteres especiais permitidos

### 4. Logs de Segurança

#### Eventos Monitorados
- Logins bem-sucedidos e falhados
- Registros de usuários
- Tentativas de acesso negado
- Rate limiting excedido
- Acessos a recursos protegidos

#### Informações Coletadas
- IP do usuário
- User-Agent
- Timestamp
- Tipo de evento
- Detalhes específicos

### 5. Middleware de Proteção

#### Proteção de Rotas
- Verificação automática de autenticação
- Redirecionamento para login
- Logs de acesso negado
- Proteção de todas as rotas não-API

### 6. Headers de Segurança

#### Headers Implementados
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## 🚨 Configuração de Produção

### Variáveis de Ambiente Obrigatórias

```env
NEXTAUTH_SECRET="sua-chave-secreta-super-forte-minimo-32-caracteres"
NEXTAUTH_URL="https://seu-dominio.com"
DATABASE_URL="sua-url-do-banco-de-dados"
NODE_ENV="production"
```

### Recomendações de Produção

1. **Use HTTPS**: Sempre em produção
2. **Configure NEXTAUTH_SECRET**: Gere uma chave forte
3. **Use Redis**: Para rate limiting em produção
4. **Monitore logs**: Configure alertas de segurança
5. **Backup regular**: Do banco de dados
6. **Atualizações**: Mantenha dependências atualizadas

## 🔧 Configurações Avançadas

### Rate Limiting Personalizado

```typescript
import { createRateLimiter } from '@/lib/rateLimit';

const customRateLimit = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // 10 tentativas
  message: 'Muitas tentativas. Tente novamente.'
});
```

### Validação Customizada

```typescript
import { validateEmail, validatePassword } from '@/lib/validation';

const emailValidation = validateEmail(email);
const passwordValidation = validatePassword(password);
```

## 📊 Monitoramento

### Logs de Segurança

Os logs de segurança são estruturados em JSON:

```json
{
  "type": "failed_login",
  "email": "user@example.com",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "details": { "reason": "invalid_password" },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production"
}
```

### Alertas Recomendados

1. **Múltiplas tentativas de login falhadas**
2. **Rate limiting excedido frequentemente**
3. **Acessos de IPs suspeitos**
4. **Tentativas de acesso a recursos não autorizados**

## 🛡️ Próximas Melhorias

### Planejadas
- [ ] Autenticação de dois fatores (2FA)
- [ ] Login com provedores sociais (Google, GitHub)
- [ ] Auditoria de ações do usuário
- [ ] Detecção de comportamento anômalo
- [ ] Backup automático de dados críticos

### Consideradas
- [ ] Integração com WAF (Web Application Firewall)
- [ ] Monitoramento de vulnerabilidades
- [ ] Testes de penetração automatizados
- [ ] Criptografia adicional de dados sensíveis

## 📞 Contato de Segurança

Para reportar vulnerabilidades de segurança:

1. **NÃO** abra issues públicos
2. Envie email para: security@seu-dominio.com
3. Inclua detalhes da vulnerabilidade
4. Aguarde resposta em até 48 horas

## 📚 Recursos Adicionais

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NextAuth.js Security](https://next-auth.js.org/configuration/security)
- [bcrypt Security](https://en.wikipedia.org/wiki/Bcrypt)
- [JWT Security Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/) 