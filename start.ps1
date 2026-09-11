# CRQ Command Center — Startup Script
# Run this from the project root (c:\cyber_risk)

# Add Node.js to PATH for this session
$env:PATH = "C:\Program Files\nodejs;$env:PATH"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Cyber Risk Command Center — SIH 2026" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check Python / FastAPI
Write-Host "[1/2] Starting FastAPI backend on http://127.0.0.1:8000 ..." -ForegroundColor Yellow
Start-Process -NoNewWindow -FilePath "python" -ArgumentList "-m", "uvicorn", "main:app", "--reload", "--port", "8000" -WorkingDirectory "c:\cyber_risk"

Start-Sleep -Seconds 3

# Start frontend
Write-Host "[2/2] Starting Vite dev server on http://localhost:5173 ..." -ForegroundColor Yellow
Set-Location "c:\cyber_risk\frontend"
npm run dev
