@echo off
:: Change directory to the folder where this batch script is saved
cd /d "%~dp0"

:: Set environment variables for DeepSeek's API
set ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
set ANTHROPIC_AUTH_TOKEN=sk-a5d30f74d29d4f9f94a5c3cffc093566
set ANTHROPIC_MODEL=deepseek-v4-pro[1m]
set ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro[1m]
set ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro[1m]
set ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash
set CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash

:: Launch PowerShell in a fresh window, inherit the env vars, and run Claude
start "Claude Code" powershell -NoExit -Command "claude --dangerously-skip-permissions"