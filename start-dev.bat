@echo off
echo Verificando a instalação do Ollama...

REM Verifica se o Ollama está instalado
where ollama >nul 2>&1
if %errorlevel% neq 0 (
    echo Erro: Ollama não encontrado no PATH.
    echo Por favor, instale o Ollama de https://ollama.ai/download
    echo e adicione-o ao PATH do sistema.
    pause
    exit /b 1
)

echo Verificando processos do Ollama...
REM Verifica e mata todos os processos relacionados ao Ollama
for /f "tokens=5" %%a in ('netstat -aon ^| find ":11434" ^| find "LISTENING"') do (
    echo Encontrado processo usando a porta 11434 ^(PID: %%a^)
    taskkill /F /PID %%a >nul 2>&1
    if errorlevel 1 (
        echo Erro ao tentar parar o processo. Por favor, pare manualmente o Ollama.
        echo Você pode fazer isso usando o Gerenciador de Tarefas ou executando:
        echo taskkill /F /IM ollama.exe
        pause
        exit /b 1
    )
)

REM Aguarda um pouco para garantir que os processos foram encerrados
timeout /t 5 /nobreak

echo Verificando se a porta 11434 está livre...
netstat -ano | find ":11434" | find "LISTENING" >nul
if not errorlevel 1 (
    echo Erro: A porta 11434 ainda está em uso.
    echo Por favor, verifique se há outros programas usando esta porta.
    pause
    exit /b 1
)

echo Iniciando o servidor Ollama...
start cmd /k "ollama serve"

echo Aguardando o servidor Ollama iniciar...
timeout /t 15 /nobreak

:CHECK_OLLAMA
curl -s http://localhost:11434/api/health >nul 2>&1
if errorlevel 1 (
    echo Aguardando Ollama iniciar...
    timeout /t 5 /nobreak
    goto CHECK_OLLAMA
) else (
    echo Ollama está rodando!
)

echo Verificando modelos disponíveis...
ollama list
echo.

echo Baixando modelo llama2:7b...
ollama pull llama2:7b

echo Iniciando o servidor Next.js...
start cmd /k "npm run dev" 