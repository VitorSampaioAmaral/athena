# Atualiza o repositório
git add .
git commit -m "Atualizacao automatica - $(Get-Date -Format 'dd/MM/yyyy HH:mm')"
git fetch origin
git pull origin main
git push origin main

Write-Host "Repositorio atualizado com sucesso!"
Write-Host "Timestamp: $(Get-Date -Format 'dd/MM/yyyy HH:mm')"
Write-Host "Pressione Enter para continuar..."
$null = Read-Host 