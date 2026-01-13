@echo off
echo Clearing Windows icon cache...
ie4uinit.exe -show
taskkill /IM explorer.exe /F
DEL /A /Q "%localappdata%\IconCache.db"
DEL /A /F /Q "%localappdata%\Microsoft\Windows\Explorer\iconcache*"
start explorer.exe
echo Icon cache cleared! You may need to log out and back in.
pause
