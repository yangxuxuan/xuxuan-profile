@echo off
"%SystemRoot%\System32\chcp.com" 65001 >nul 2>nul
title 杨许煊个人网站 - 本地预览
cd /d "%~dp0"

node --version >nul 2>nul
if errorlevel 1 (
  echo.
  echo 未检测到 Node.js，暂时无法启动本地网站。
  echo 请先安装 Node.js，然后重新双击此文件。
  echo.
  pause
  exit /b 1
)

node "scripts\dev-server.cjs"

if errorlevel 1 (
  echo.
  pause
)
