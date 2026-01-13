; ClaudeGUI - NSIS Installer Script
; Adds "Open with ClaudeGUI" to Windows context menu

!macro customInstall
  ; Add context menu for folders (right-click on folder)
  WriteRegStr HKCR "Directory\shell\OpenWithClaudeGUI" "" "Open with ClaudeGUI"
  WriteRegStr HKCR "Directory\shell\OpenWithClaudeGUI" "Icon" "$INSTDIR\ClaudeGUI.exe"
  WriteRegStr HKCR "Directory\shell\OpenWithClaudeGUI\command" "" '"$INSTDIR\ClaudeGUI.exe" --cwd "%V"'

  ; Add context menu for folder background (right-click inside folder)
  WriteRegStr HKCR "Directory\Background\shell\OpenWithClaudeGUI" "" "Open with ClaudeGUI"
  WriteRegStr HKCR "Directory\Background\shell\OpenWithClaudeGUI" "Icon" "$INSTDIR\ClaudeGUI.exe"
  WriteRegStr HKCR "Directory\Background\shell\OpenWithClaudeGUI\command" "" '"$INSTDIR\ClaudeGUI.exe" --cwd "%V"'

  ; Add context menu for drives
  WriteRegStr HKCR "Drive\shell\OpenWithClaudeGUI" "" "Open with ClaudeGUI"
  WriteRegStr HKCR "Drive\shell\OpenWithClaudeGUI" "Icon" "$INSTDIR\ClaudeGUI.exe"
  WriteRegStr HKCR "Drive\shell\OpenWithClaudeGUI\command" "" '"$INSTDIR\ClaudeGUI.exe" --cwd "%V"'
!macroend

!macro customUnInstall
  ; Remove context menu entries
  DeleteRegKey HKCR "Directory\shell\OpenWithClaudeGUI"
  DeleteRegKey HKCR "Directory\Background\shell\OpenWithClaudeGUI"
  DeleteRegKey HKCR "Drive\shell\OpenWithClaudeGUI"
!macroend
