# Atualiza o repositório
git add .
git commit -m "Atualizacao automatica - $(Get-Date -Format 'dd/MM/yyyy HH:mm')"

# Verifica qual branch está ativo
$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Host "Branch atual: $currentBranch"

# Atualiza ambos os branches
git fetch origin
git pull origin master
git pull origin main

# Força o push para o branch atual
if ($currentBranch -eq "master") {
    git push -f origin master
} else {
    git push -f origin main
}

Write-Host "Repositorio atualizado com sucesso!"
Write-Host "Timestamp: $(Get-Date -Format 'dd/MM/yyyy HH:mm')"
Write-Host "Pressione Enter para continuar..."
$null = Read-Host 

