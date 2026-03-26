!macro NSIS_HOOK_POSTINSTALL
  ; 修改卸载程序在控制面板中显示的名称为中文
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_IDENTIFIER}" "DisplayName" "小简-MD2CV简历工作台"

  ; 删除英文快捷方式，创建中文快捷方式
  Delete "$SMPROGRAMS\MAX-MD2CV.lnk"
  Delete "$SMPROGRAMS\MAX-MD2CV\MAX-MD2CV.lnk"
  RMDir "$SMPROGRAMS\MAX-MD2CV"
  CreateShortcut "$SMPROGRAMS\小简-MD2CV简历工作台.lnk" "$INSTDIR\MAX-MD2CV.exe"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; 卸载时删除中文快捷方式
  Delete "$SMPROGRAMS\小简-MD2CV简历工作台.lnk"
!macroend
