; ─────────────────────────────────────────────────────────────────────────────
; Pocket Shop Studio — Windows NSIS Installer
; Ships portable node.exe + app source — no pkg binary, no cross-compile issues
; Per-user install, no UAC required
; ─────────────────────────────────────────────────────────────────────────────

Unicode True

!define APP_NAME       "Pocket Shop Studio"
!define APP_VERSION    "1.0.0"
!define APP_PUBLISHER  "Pocket Shop"
!define APP_URL        "https://github.com/eurobuddha/pocketShop"
!define INSTALL_DIR    "$LOCALAPPDATA\${APP_NAME}"
!define UNINSTALL_KEY  "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"

Name                   "${APP_NAME}"
OutFile                "..\release\PocketShop-Studio-${APP_VERSION}-Setup.exe"
InstallDir             "${INSTALL_DIR}"
InstallDirRegKey       HKCU "${UNINSTALL_KEY}" "InstallLocation"
RequestExecutionLevel  user
SetCompressor /SOLID   lzma
ShowInstDetails        show

Icon          "..\release\staging\icon.ico"
UninstallIcon "..\release\staging\icon.ico"

VIProductVersion       "1.0.0.0"
VIAddVersionKey "ProductName"      "${APP_NAME}"
VIAddVersionKey "ProductVersion"   "${APP_VERSION}"
VIAddVersionKey "CompanyName"      "${APP_PUBLISHER}"
VIAddVersionKey "FileDescription"  "${APP_NAME} Installer"
VIAddVersionKey "LegalCopyright"   "Copyright 2026 Pocket Shop"
VIAddVersionKey "FileVersion"      "${APP_VERSION}"

Page instfiles

Section "Install"

    SetOutPath "$INSTDIR"

    ; ── Copy all staged files ─────────────────────────────────────────────────
    File /r "..\release\staging\*.*"

    ; ── Write the VBScript launcher — runs server with NO visible window ────────
    ; Logs every step to %TEMP%\pocketshop-launch.log.
    ; Shows a MsgBox with the error + log path if anything fails.
    FileOpen  $0 "$INSTDIR\launch.vbs" w
    FileWrite $0 "On Error Resume Next$\r$\n"
    FileWrite $0 "$\r$\n"
    FileWrite $0 "Set fso = CreateObject($\"Scripting.FileSystemObject$\")$\r$\n"
    FileWrite $0 "Set sh  = CreateObject($\"WScript.Shell$\")$\r$\n"
    FileWrite $0 "$\r$\n"
    FileWrite $0 "Dim d, logFile$\r$\n"
    FileWrite $0 "d       = fso.GetParentFolderName(WScript.ScriptFullName)$\r$\n"
    FileWrite $0 "logFile = sh.ExpandEnvironmentStrings($\"%TEMP%$\") & $\"\pocketshop-launch.log$\"$\r$\n"
    FileWrite $0 "$\r$\n"
    FileWrite $0 "Set f = fso.OpenTextFile(logFile, 8, True)$\r$\n"
    FileWrite $0 "f.WriteLine $\"--- $\" & Now & $\" ---$\"$\r$\n"
    FileWrite $0 "f.WriteLine $\"script:    $\" & WScript.ScriptFullName$\r$\n"
    FileWrite $0 "f.WriteLine $\"dir:       $\" & d$\r$\n"
    FileWrite $0 "f.WriteLine $\"node.exe:  $\" & fso.FileExists(d & $\"\node.exe$\")$\r$\n"
    FileWrite $0 "f.WriteLine $\"studio.js: $\" & fso.FileExists(d & $\"\studio.js$\")$\r$\n"
    FileWrite $0 "$\r$\n"
    FileWrite $0 "sh.CurrentDirectory = d$\r$\n"
    FileWrite $0 "f.WriteLine $\"chdir err: $\" & Err.Number & $\" $\" & Err.Description$\r$\n"
    FileWrite $0 "Err.Clear$\r$\n"
    FileWrite $0 "$\r$\n"
    FileWrite $0 "Dim nodeExe, studioJs, runCmd$\r$\n"
    FileWrite $0 "nodeExe  = d & $\"\node.exe$\"$\r$\n"
    FileWrite $0 "studioJs = d & $\"\studio.js$\"$\r$\n"
    FileWrite $0 "$\r$\n"
    FileWrite $0 "' Route all node.js stdout+stderr into the same log file.$\r$\n"
    FileWrite $0 "' File handle is closed first so the >> redirect is never locked out.$\r$\n"
    FileWrite $0 "runCmd = $\"cmd /C $\" & Chr(34) & Chr(34) & nodeExe & Chr(34) & $\" $\" & Chr(34) & studioJs & Chr(34) & $\" >> $\" & Chr(34) & logFile & Chr(34) & $\" 2>&1$\" & Chr(34)$\r$\n"
    FileWrite $0 "f.WriteLine $\"command:   $\" & runCmd$\r$\n"
    FileWrite $0 "f.WriteLine $\"--- node.js output follows ---$\"$\r$\n"
    FileWrite $0 "f.Close$\r$\n"
    FileWrite $0 "$\r$\n"
    FileWrite $0 "sh.Run runCmd, 0, False$\r$\n"
    FileWrite $0 "$\r$\n"
    FileWrite $0 "If Err.Number <> 0 Then$\r$\n"
    FileWrite $0 "    MsgBox $\"Pocket Shop Studio failed to start.$\" & vbCrLf & vbCrLf & Err.Description & vbCrLf & vbCrLf & $\"See log: $\" & logFile, 16, $\"Pocket Shop Studio$\"$\r$\n"
    FileWrite $0 "End If$\r$\n"
    FileClose $0

    ; ── Write uninstaller ────────────────────────────────────────────────────
    WriteUninstaller "$INSTDIR\Uninstall.exe"

    ; ── Registry (Add/Remove Programs) ───────────────────────────────────────
    WriteRegStr   HKCU "${UNINSTALL_KEY}" "DisplayName"     "${APP_NAME}"
    WriteRegStr   HKCU "${UNINSTALL_KEY}" "DisplayVersion"  "${APP_VERSION}"
    WriteRegStr   HKCU "${UNINSTALL_KEY}" "Publisher"       "${APP_PUBLISHER}"
    WriteRegStr   HKCU "${UNINSTALL_KEY}" "URLInfoAbout"    "${APP_URL}"
    WriteRegStr   HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr   HKCU "${UNINSTALL_KEY}" "UninstallString" "$INSTDIR\Uninstall.exe"
    WriteRegStr   HKCU "${UNINSTALL_KEY}" "DisplayIcon"     "$INSTDIR\icon.ico"
    WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify"        1
    WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair"        1

    ; ── Shortcuts — wscript.exe runs launch.vbs silently (no console window) ──
    CreateShortcut "$DESKTOP\${APP_NAME}.lnk" \
        "$WINDIR\System32\wscript.exe" \
        '"$INSTDIR\launch.vbs"' \
        "$INSTDIR\icon.ico" 0

    CreateDirectory "$SMPROGRAMS\${APP_NAME}"
    CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" \
        "$WINDIR\System32\wscript.exe" \
        '"$INSTDIR\launch.vbs"' \
        "$INSTDIR\icon.ico" 0
    CreateShortcut "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk" \
        "$INSTDIR\Uninstall.exe"

    MessageBox MB_OK|MB_ICONINFORMATION \
        "${APP_NAME} installed!$\r$\n$\r$\nDouble-click the desktop shortcut to launch.$\r$\nYour browser will open at http://localhost:3456$\r$\n$\r$\nGenerated shop files go to:$\r$\nDocuments\PocketShop\dist"

SectionEnd

Section "Uninstall"
    ExecWait 'taskkill /F /IM node.exe' $0
    RMDir /r "$INSTDIR"
    Delete "$DESKTOP\${APP_NAME}.lnk"
    Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
    Delete "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk"
    RMDir  "$SMPROGRAMS\${APP_NAME}"
    DeleteRegKey HKCU "${UNINSTALL_KEY}"
SectionEnd
