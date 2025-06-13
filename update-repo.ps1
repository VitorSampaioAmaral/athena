# Obtém a data e hora atual para usar na mensagem do commit
$timestamp = Get-Date -Format "dd/MM/yyyy HH:mm"

# Adiciona todos os arquivos modificados ao stage
git add .

# Cria um commit com a data/hora
git commit -m "Atualizacao automatica - $timestamp"

# Faz push para a branch origin
git pull origin main

git push origin main

# Exibe mensagem de conclusão
Write-Host "Repositorio atualizado com sucesso!" -ForegroundColor Green
Write-Host "Timestamp: $timestamp" -ForegroundColor Cyan

# Pausa para ver o resultado
pause 