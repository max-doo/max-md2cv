!macro NSIS_HOOK_POSTINSTALL
  ; 在所有用户路径下操作
  SetShellVarContext all
  
  ; 修改卸载程序在控制面板中显示的名称为中文
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_IDENTIFIER}" "DisplayName" "小简-MD2CV简历工作台"

  DetailPrint "正在从所有用户路径清理默认英文快捷方式..."
  Delete "$SMPROGRAMS\MAX-MD2CV.lnk"
  Delete "$DESKTOP\MAX-MD2CV.lnk"
  Delete "$SMPROGRAMS\MAX-MD2CV\MAX-MD2CV.lnk"
  RMDir "$SMPROGRAMS\MAX-MD2CV"

  ; 切换到当前用户路径再次清理，防止残留
  SetShellVarContext current
  DetailPrint "正在从当前用户路径清理残留快捷方式..."
  Delete "$SMPROGRAMS\MAX-MD2CV.lnk"
  Delete "$DESKTOP\MAX-MD2CV.lnk"
  Delete "$SMPROGRAMS\MAX-MD2CV\MAX-MD2CV.lnk"

  ; 重新切回 all 准备创建
  SetShellVarContext all
  DetailPrint "正在创建中文快捷方式..."
  ; 创建中文快捷方式，指向实际生成的二进制文件 max-md2cv-app.exe
  CreateShortcut "$SMPROGRAMS\小简-MD2CV简历工作台.lnk" "$INSTDIR\max-md2cv-app.exe" "" "$INSTDIR\max-md2cv-app.exe" 0
  CreateShortcut "$DESKTOP\小简-MD2CV简历工作台.lnk" "$INSTDIR\max-md2cv-app.exe" "" "$INSTDIR\max-md2cv-app.exe" 0
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  SetShellVarContext all
  ; 卸载时删除中文快捷方式
  Delete "$SMPROGRAMS\小简-MD2CV简历工作台.lnk"
  Delete "$DESKTOP\小简-MD2CV简历工作台.lnk"
  
  SetShellVarContext current
  Delete "$SMPROGRAMS\小简-MD2CV简历工作台.lnk"
  Delete "$DESKTOP\小简-MD2CV简历工作台.lnk"
!macroend
