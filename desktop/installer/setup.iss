; ============================================================
;  ARM Dezhurnogo VGSCH - installer
;  Built by desktop\csharp\build.bat installer
;  Requires Inno Setup 6: https://jrsoftware.org/isdl.php
; ============================================================

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "..\csharp\dist"
#endif
#ifndef OutputDir
  #define OutputDir "..\csharp\installer-out"
#endif

#define AppName       "ARM Dezhurnogo VGSCH"
#define AppNameRu     "АРМ Дежурного ВГСЧ"
#define AppExe        "VGSCH-ARM.exe"
#define AppPublisher  "ВГСЧ"

[Setup]
AppId={{7B3C1E42-9A55-4D18-B6F3-2E8C4A1D9F70}
AppName={#AppNameRu}
AppVersion={#AppVersion}
AppVerName={#AppNameRu} {#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName=C:\VGSCH-ARM
DefaultGroupName={#AppNameRu}
DisableProgramGroupPage=yes
DisableDirPage=no
OutputDir={#OutputDir}
OutputBaseFilename=VGSCH-ARM-Setup-{#AppVersion}
SetupIconFile={#SourceDir}\vgsch.ico
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppNameRu}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
MinVersion=10.0

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"

[Tasks]
Name: "desktopicon"; Description: "Создать ярлык на рабочем столе"; GroupDescription: "Дополнительно:"
Name: "startup";     Description: "Запускать при входе в систему"; GroupDescription: "Дополнительно:"; Flags: unchecked

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall noencryption skipifsourcedoesntexist; Check: NeedsWebView2

[Icons]
Name: "{group}\{#AppNameRu}";        Filename: "{app}\{#AppExe}"; WorkingDir: "{app}"; IconFilename: "{app}\vgsch.ico"
Name: "{group}\Удалить {#AppNameRu}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppNameRu}";  Filename: "{app}\{#AppExe}"; WorkingDir: "{app}"; IconFilename: "{app}\vgsch.ico"; Tasks: desktopicon
Name: "{userstartup}\{#AppNameRu}";  Filename: "{app}\{#AppExe}"; WorkingDir: "{app}"; Tasks: startup

[Run]
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Установка компонента WebView2..."; Flags: waituntilterminated; Check: NeedsWebView2
Filename: "{app}\{#AppExe}"; Description: "Запустить {#AppNameRu}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\web"
Type: filesandordirs; Name: "{localappdata}\VGSCH-ARM"

[Code]
// WebView2 нужен для отображения интерфейса. Если он уже стоит
// (а на Windows 11 он обычно стоит), ставить повторно незачем.
function NeedsWebView2: Boolean;
var
  V: String;
begin
  Result := True;
  if RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', V) then
    if (V <> '') and (V <> '0.0.0.0') then Result := False;
  if Result then
    if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', V) then
      if (V <> '') and (V <> '0.0.0.0') then Result := False;
  if Result then
    if RegQueryStringValue(HKCU, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', V) then
      if (V <> '') and (V <> '0.0.0.0') then Result := False;
end;

// Закрыть запущенную программу перед обновлением, иначе файлы заблокированы
procedure CurStepChanged(CurStep: TSetupStep);
var
  Res: Integer;
begin
  if CurStep = ssInstall then
    Exec('taskkill.exe', '/F /IM {#AppExe}', '', SW_HIDE, ewWaitUntilTerminated, Res);
end;