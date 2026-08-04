# CharlieApp v3 — Guia de Segurança Completo

## Visão Geral

CharlieApp é uma PWA (Progressive Web App) de ferramentas hacker self-hosted, rodando no Dell (Debian 12) na porta 4000. O acesso é restrito à rede Tailscale (100.116.60.65) e à rede local (10.0.0.0/24). O frontend é servido via Cloudflare Pages (static) com proxy para o backend Dell.

---

## Arquitetura de Segurança

```
[Usuário] → Cloudflare Pages (HTTPS) → Cloudflare Worker (proxy) → Dell:4000 (Tailscale)
```

- **Frontend**: Cloudflare Pages (estático, HTTPS automático)
- **Backend**: Dell Debian na porta 4000, bind em `0.0.0.0` (acessível via Tailscale)
- **Rede**: Tailscale mesh (IP 100.116.60.65 no Dell)
- **Firewall**: iptables bloqueia todo acesso exceto Tailscale e LAN

---

## Endpoints e Ferramentas

### 1. `GET /api/status` — Verificação de Saúde

**O que faz**: Verifica se o Ollama está online e lista os modelos disponíveis. Retorna uptime do servidor.

**Uso seguro**:
```
GET http://100.116.60.65:4000/api/status
```
- Sem autenticação — endpoint público interno
- Retorna `{ status: "online", ollama: true, models: [...], tailscale: "100.116.60.65", uptime: ... }`
- Use para verificar se o backend está funcionando antes de usar outras ferramentas

---

### 2. `POST /api/say` — Chat com IA (hermes3:latest)

**O que faz**: Envia uma mensagem para o modelo hermes3:latest do Ollama e retorna a resposta.

**Uso seguro**:
```
POST http://100.116.60.65:4000/api/say
Content-Type: application/json

{
  "message": "Sua pergunta aqui"
}
```

**Regras de segurança**:
- Apenas mensagens de texto — sem uploads de arquivos
- O modelo hermes3:latest é o único disponível — não é possível trocar de modelo via API
- Timeout de 30 segundos — respostas longas são truncadas
- **Nunca envie dados sensíveis** (senhas, chaves, documentos pessoais) no campo `message` — o Ollama processa localmente mas o histórico não é persistente entre sessões
- O backend não armazena histórico de chat — cada requisição é independente

---

### 3. `POST /api/pix-scan` — Scanner de QR Code Pix

**O que faz**: Analisa um QR Code Pix e extrai os dados (valor, chave, tipo).

**Uso seguro**:
```
POST http://100.116.60.65:4000/api/pix-scan
Content-Type: application/json

{
  "qr": "pix.bcb.gov.br/pix/..."
}
```

**Regras de segurança**:
- O QR Code é processado **apenas localmente** — nenhum dado é enviado para servidores externos
- O raw do QR é truncado para os primeiros 200 caracteres na resposta
- **Nunca escaneie QR Codes de fontes não confiáveis** — podem conter URLs maliciosas
- O tipo de QR é classificado como `pix_brcode`, `pix_chave` ou `unknown`
- Use apenas para verificar dados de QR Codes Pix que você recebeu de fontes conhecidas

---

### 4. `POST /api/pix-validate` — Validar Transação Pix

**O que faz**: Valida os dados de uma transação Pix e gera um ID de transação simulado.

**Uso seguro**:
```
POST http://100.116.60.65:4000/api/pix-validate
Content-Type: application/json

{
  "amount": "100.00",
  "key": "12345678900"
}
```

**Regras de segurança**:
- A chave Pix é mascarada na resposta (mostra apenas os 6 primeiros e últimos 4 dígitos)
- O valor e a chave **não são armazenados** — processamento em memória apenas
- O hash SHA-256 do timestamp é usado como ID de transação — não é um ID real do Banco Central
- **Este endpoint NÃO processa pagamentos reais** — é apenas para validação de formato de dados Pix
- Nunca envie chaves Pix de outras pessoas sem autorização

---

### 5. `GET /api/scan-ports` — Scanner de Portas

**O que faz**: Verifica quais portas estão abertas em um host específico.

**Uso seguro**:
```
GET http://100.116.60.65:4000/api/scan-ports?host=10.0.0.142
```

**Regras de segurança**:
- **Use APENAS em hosts da sua rede** (10.0.0.0/24 ou 100.64.0.0/10 para Tailscale)
- Nunca escaneie hosts na internet pública — isso pode ser detectado como atividade maliciosa
- Portas escaneadas: 22, 80, 443, 8080, 3000, 4000, 11434, 5678, 20128, 8000, 9000
- Timeout de 800ms por porta — scan completo leva ~11 segundos
- **Não abuse do endpoint** — scans repetidos em rápida sucessão podem bloquear conexões legítimas

---

### 6. `GET /api/dns` — Lookup DNS

**O que faz**: Resolve um hostname para um endereço IP usando o resolver do sistema.

**Uso seguro**:
```
GET http://100.116.60.65:4000/api/dns?host=google.com
```

**Regras de segurança**:
- Usa `dns.lookup` do Node.js — resolução local, sem consulta a servidores DNS externos controlados por você
- **Não use para enumerar subdomínios** de domínios que não são seus
- Útil para verificar se um domínio resolve antes de acessá-lo
- Retorna o IP resolvido ou erro se o hostname não for resolvível

---

### 7. `GET /api/hash` — Verificador de Hash

**O que faz**: Calcula o hash SHA-256 (ou outro algoritmo) de um texto.

**Uso seguro**:
```
GET http://100.116.60.65:4000/api/hash?text=hello&algo=sha256
```

**Algoritmos suportados**: sha256, md5, sha1, sha384, sha512

**Regras de segurança**:
- O texto é processado **apenas localmente** — nada é enviado para fora
- O texto é truncado para 50 caracteres na resposta (preview)
- Use para verificar integridade de arquivos/downloads comparando hashes
- **Nunca use para gerar hashes de senhas** — use um gerador de senhas dedicado

---

### 8. `POST /api/encrypt` — Criptografia AES-256-CBC

**O que faz**: Criptografa texto usando AES-256-CBC com chave e IV hexadecimais.

**Uso seguro**:
```
POST http://100.116.60.65:4000/api/encrypt
Content-Type: application/json

{
  "text": "mensagem secreta",
  "key": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "iv": "0123456789abcdef0123456789abcdef"
}
```

**Regras de segurança**:
- Chave deve ter 64 caracteres hex (32 bytes = 256 bits)
- IV deve ter 32 caracteres hex (16 bytes = 128 bits)
- **A criptografia é simétrica** — quem tem a chave e o IV pode descriptografar
- **Nunca compartilhe a chave e o IV pelo chat** — envie por canal separado seguro
- O texto criptografado é retornado em hex — converta para base64 se precisar transmitir
- Para máxima segurança, gere chaves e IVs usando o endpoint `/api/gen-password` e compartilhe via canal seguro (ex: Matrix, Signal)

---

### 9. `POST /api/decrypt` — Descriptografia AES-256-CBC

**O que faz**: Descriptografa texto previamente criptografado com AES-256-CBC.

**Uso seguro**:
```
POST http://100.116.60.65:4000/api/decrypt
Content-Type: application/json

{
  "enc": "a1b2c3d4...",
  "key": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "iv": "0123456789abcdef0123456789abcdef"
}
```

**Regras de segurança**:
- Requer a mesma chave e IV usados na criptografia
- Se a chave ou IV estiverem incorretos, retorna erro (não revela o texto original)
- **Nunca envie dados criptografados e chaves no mesmo canal não seguro**
- Use para descriptografar dados que você mesmo criptografou

---

### 10. `GET /api/gen-password` — Gerador de Senhas

**O que faz**: Gera uma senha aleatória com comprimento configurável.

**Uso seguro**:
```
GET http://100.116.60.65:4000/api/gen-password?length=32
```

**Regras de segurança**:
- Comprimento padrão: 16 caracteres
- Charset: `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*`
- Força: `strong` (≥16 chars) ou `medium` (<16 chars)
- Use senhas de pelo menos 16 caracteres para contas importantes
- **Nunca reutilize senhas geradas** — cada senha deve ser única por serviço
- Salve senhas em um gerenciador de senhas (Bitwarden, KeePassXC), NUNCA em texto plano

---

### 11. `GET /api/server` — Informações do Servidor

**O que faz**: Retorna informações do sistema (OS, CPU, RAM, disco, uptime).

**Uso seguro**:
```
GET http://100.116.60.65:4000/api/server
```

**Regras de segurança**:
- **Este endpoint expõe informações do sistema** — não compartilhe os resultados publicamente
- Informações incluem: modelo da CPU, quantidade de RAM, espaço em disco, uptime
- Útil para diagnóstico de performance e troubleshooting
- Em ambientes compartilhados, considere restringir este endpoint

---

### 12. `GET /api/network` — Informações de Rede

**O que faz**: Retorna interfaces de rede, rotas e IP público do servidor.

**Uso seguro**:
```
GET http://100.116.60.65:4000/api/network
```

**Regras de segurança**:
- O IP público é obtido via `curl ifconfig.me` — pode falhar se o servidor não tiver acesso à internet
- As interfaces de rede mostram todos os adaptadores configurados
- **Não compartilhe a saída deste endpoint publicamente** — revela a topologia da sua rede
- Útil para debugging de conectividade Tailscale e verificar se o IP correto está sendo usado

---

## Regras de Segurança Gerais

### 1. Acesso à Rede
- O CharlieApp **só deve ser acessado via Tailscale** (100.116.60.65) ou rede local (10.0.0.0/24)
- Acesso pela internet pública é **bloqueado por firewall** (iptables DROP)
- Nunca expõe a porta 4000 para a internet

### 2. Autenticação
- O frontend usa **PIN auth** (4 dígitos, salvo em localStorage do navegador)
- O PIN é opcional — "Entrar sem PIN" está disponível
- O PIN **não é enviado ao servidor** — é validado localmente no navegador
- Para máxima segurança, use o PIN e não compartilhe o dispositivo

### 3. Dados
- **Nenhum dado é persistido no servidor** entre requisições
- Cada endpoint processa a requisição e descarta os dados
- Não há banco de dados, não há logs de chat, não há histórico de sessão

### 4. HTTPS
- O frontend Cloudflare Pages serve automaticamente via HTTPS
- O backend Dell comunica via HTTP na porta 4000 (apenas acessível via Tailscale)
- O Cloudflare Worker proxy adiciona HTTPS entre o usuário e o Cloudflare Pages

### 5. QR Infinity
- O QR Pix scanner é o recurso core — **inegociável**
- Processamento 100% local — nenhum dado sai do Dell

### 6. Atualizações
- Mantenha o repositório GitHub atualizado: `git pull origin main` no Dell
- Após atualizar, reinicie o CharlieApp: `cd /home/dont/charlie-app && npm start`
- O Dockerfile usa `node:20-slim` — mantenha a imagem atualizada

### 7. Firewall
As regras iptables atuais:
```
- INPUT: DROP tudo exceto
  - 127.0.0.1 (loopback)
  - 100.116.60.65 (Tailscale)
  - 10.0.0.0/24 (rede local)
  - Portas 22 (SSH), 4000 (CharlieApp), 11434 (Ollama)
- OUTPUT: ACCEPT tudo
```

---

## Checklist de Segurança

- [ ] Acesso apenas via Tailscale (verificar `100.116.60.65`)
- [ ] Firewall ativo (iptables rules salvos em `/etc/iptables/rules.v4`)
- [ ] PIN auth ativado no frontend
- [ ] HTTPS no frontend (Cloudflare Pages)
- [ ] Sem dados sensíveis no histórico de chat (não persiste)
- [ ] Chaves de criptografia compartilhadas por canal seguro separado
- [ ] Senhas geradas salvas em gerenciador de senhas
- [ ] QR Codes escaneados apenas de fontes confiáveis
- [ ] Port scanner usado apenas na própria rede
- [ ] Repositório GitHub privado
- [ ] SSH key authentication (ed25519, sem senha no disco)
- [ ] Docker container não expõe portas para a internet

---

## Comandos Rápidos de Segurança

Verificar firewall ativo:
```
sudo iptables -L -n | grep DROP
```

Verificar regras persistentes:
```
sudo cat /etc/iptables/rules.v4
```

Verificar se Tailscale está ativo:
```
sudo tailscale status
```

Verificar se CharlieApp está rodando:
```
curl http://127.0.0.1:4000/api/status
```

Verificar se acesso externo está bloqueado:
```
curl http://$(curl -s ifconfig.me):4000/api/status
# Deve falhar (exit code 7 = connection refused/timed out)
```

---

## Resumo das Ferramentas

| Endpoint | Método | Função | Segurança |
|----------|--------|--------|-----------|
| `/api/status` | GET | Saúde do servidor | Público interno |
| `/api/say` | POST | Chat com IA | Local, sem persistência |
| `/api/pix-scan` | POST | Scanner QR Pix | 100% local |
| `/api/pix-validate` | POST | Validar Pix | Local, mascaramento de chave |
| `/api/scan-ports` | GET | Scanner de portas | Restrito à LAN/Tailscale |
| `/api/dns` | GET | Lookup DNS | Local |
| `/api/hash` | GET | Gerador de hash | Local |
| `/api/encrypt` | POST | Criptografar AES-256 | Local, chave não persiste |
| `/api/decrypt` | POST | Descriptografar AES-256 | Local, chave não persiste |
| `/api/gen-password` | GET | Gerar senha | Local |
| `/api/server` | GET | Info do servidor | Público interno |
| `/api/network` | GET | Info de rede | Público interno |

---

*Guia de segurança do CharlieApp v3 — Mantenha este documento atualizado conforme novas funcionalidades são adicionadas.*
