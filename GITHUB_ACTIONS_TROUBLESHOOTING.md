# GitHub Actions Troubleshooting - pnpm + setup-node

## Problema: "Dependencies lock file is not found"

### Erro
```
Error: Dependencies lock file is not found in /home/runner/work/athena/athena. 
Supported file patterns: package-lock.json,npm-shrinkwrap.json,yarn.lock
```

### Causa
A action `actions/setup-node@v4` procura automaticamente por arquivos de lock do npm/yarn, mas não reconhece o `pnpm-lock.yaml`.

### Soluções

#### 1. **Solução Recomendada: Setup pnpm ANTES do setup-node**
```yaml
- name: Setup pnpm
  uses: pnpm/action-setup@v2
  with:
    version: 8

- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    # NÃO usar cache automático aqui
```

#### 2. **Solução Alternativa: Sem setup-node**
```yaml
- name: Setup pnpm
  uses: pnpm/action-setup@v2
  with:
    version: 8
    run_install: false

- name: Install Node.js manually
  run: |
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
```

#### 3. **Configuração de Cache Manual**
```yaml
- name: Get pnpm store directory
  shell: bash
  run: |
    echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

- name: Setup pnpm cache
  uses: actions/cache@v4
  with:
    path: ${{ env.STORE_PATH }}
    key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-store-
```

### Workflows Disponíveis

1. **`fix-node-setup.yml`** - Solução recomendada com cache manual
2. **`minimal-build.yml`** - Solução sem setup-node
3. **`simple-build.yml`** - Solução básica
4. **`test-pnpm.yml`** - Workflow de teste

### Configurações no package.json
```json
{
  "packageManager": "pnpm@8.15.0",
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

### Como Testar
1. Faça push para `main` ou `master`
2. Ou use `workflow_dispatch` para executar manualmente
3. Verifique os logs do workflow escolhido

### Notas Importantes
- Sempre configure o pnpm **antes** do setup-node
- Evite usar cache automático no setup-node com pnpm
- Use cache manual do pnpm para melhor performance
- O `pnpm-lock.yaml` deve estar no repositório (não no .gitignore) 