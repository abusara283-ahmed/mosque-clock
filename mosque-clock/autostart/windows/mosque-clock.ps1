<#
  ساعة المسجد — التشغيل التلقائي على ويندوز (الإصدار ٨)
  Mosque Clock — Windows autostart / kiosk launcher (v8)

  الاستخدام (يُستدعى من ملفات .bat في المجلد نفسه):
    -Action install    تثبيت التشغيل التلقائي عند تسجيل الدخول + منع السكون + تشغيل الآن
    -Action uninstall  إزالة التشغيل التلقائي وإيقاف الساعة
    -Action stop       إيقاف الساعة الآن (تعود عند التشغيل القادم للجهاز)
    -Action run        حلقة التشغيل نفسها (تستدعيها المهمة المجدولة، لا تشغّلها يدوياً)
    -Action status     حالة التثبيت بصيغة JSON (يستعملها server.js لصفحة الإعدادات)
  خيارات: -Quiet (بلا نوافذ رسائل) ، -NoStart (لا تفتح الساعة بعد التثبيت) ، -FrontIdleMinutes 2

  ما يفعله أثناء التشغيل:
    - يشغّل server.js إن وُجد Node.js (للتحكم من الجوال وتصحيح الوقت)، وإلا يفتح index.html مباشرة.
    - يفتح Chrome (أو Edge إن لم يوجد Chrome) بوضع العرض kiosk بملف تعريف خاص، والصوت يعمل بلا لمس.
    - إن أُغلق المتصفح أو انهار يعيد فتحه بعد ٥ ثوانٍ.
    - إن بقي برنامج آخر في الأمام ولم يلمس أحد الفأرة أو لوحة المفاتيح لدقيقتين، تعود الساعة للأمام.
  السجل: %LOCALAPPDATA%\MosqueClock\launcher.log
#>
param(
  [ValidateSet('install', 'uninstall', 'stop', 'run', 'status')]
  [string]$Action = 'install',
  [switch]$Quiet,
  [switch]$NoStart,
  [int]$FrontIdleMinutes = -1
)

$ErrorActionPreference = 'Continue'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = (Resolve-Path (Join-Path $Here '..\..')).Path
$Data = Join-Path $env:LOCALAPPDATA 'MosqueClock'
if (-not (Test-Path $Data)) { New-Item -ItemType Directory -Force -Path $Data | Out-Null }
$LogFile = Join-Path $Data 'launcher.log'
$StopFlag = Join-Path $Data 'stop.flag'
$BrowserProfile = Join-Path $Data 'browser-profile'
$ConfigFile = Join-Path $Data 'config.json'
$PinFile = Join-Path $Data 'pin.txt'
$ServerPidFile = Join-Path $Data 'server.pid'
$Vbs = Join-Path $Data 'run-hidden.vbs'
$TaskName = 'MosqueClock'
$Port = 8080
$StartupLnk = Join-Path ([Environment]::GetFolderPath('Startup')) 'MosqueClock.lnk'

function Write-Log([string]$m) {
  try {
    if ((Test-Path $LogFile) -and ((Get-Item $LogFile).Length -gt 1MB)) { Move-Item -Force $LogFile "$LogFile.old" }
    Add-Content -Path $LogFile -Value ("{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m) -Encoding UTF8
  } catch {}
}

function Show-Message([string]$text, [string]$title = 'ساعة المسجد', [string]$buttons = 'OK', [string]$icon = 'Information') {
  if ($Quiet) { return 'OK' }
  try {
    Add-Type -AssemblyName System.Windows.Forms
    # RtlReading + RightAlign لعرض العربية صحيحة
    $opts = [System.Windows.Forms.MessageBoxOptions]::RtlReading -bor [System.Windows.Forms.MessageBoxOptions]::RightAlign
    return [string][System.Windows.Forms.MessageBox]::Show($text, $title, $buttons, $icon, 'Button1', $opts)
  } catch { Write-Host $text; return 'OK' }
}

function Get-Config {
  $cfg = @{ frontIdleMinutes = 2 }
  if (Test-Path $ConfigFile) {
    try { $j = Get-Content $ConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json; if ($null -ne $j.frontIdleMinutes) { $cfg.frontIdleMinutes = [int]$j.frontIdleMinutes } } catch {}
  }
  return $cfg
}

function Find-Browser {
  $list = @(
    @{ kind = 'chrome'; path = (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe') },
    @{ kind = 'chrome'; path = (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe') },
    @{ kind = 'chrome'; path = (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe') },
    @{ kind = 'edge'; path = (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe') },
    @{ kind = 'edge'; path = (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe') }
  )
  foreach ($b in $list) { if ($b.path -and (Test-Path $b.path)) { return $b } }
  return $null
}

function Find-Node {
  $c = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  foreach ($p in @((Join-Path $env:ProgramFiles 'nodejs\node.exe'), (Join-Path ${env:ProgramFiles(x86)} 'nodejs\node.exe'))) { if ($p -and (Test-Path $p)) { return $p } }
  return $null
}

function Test-Port([int]$p) {
  $c = New-Object System.Net.Sockets.TcpClient
  try {
    $iar = $c.BeginConnect('127.0.0.1', $p, $null, $null)
    if (-not $iar.AsyncWaitHandle.WaitOne(600)) { return $false }
    $c.EndConnect($iar); return $true
  } catch { return $false } finally { $c.Close() }
}

function Get-KioskProcesses {
  # عمليات المتصفح التي تستعمل ملف التعريف الخاص بالساعة فقط (لا نلمس متصفح المستخدم العادي)
  $needle = $BrowserProfile.ToLower()
  try {
    return @(Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='msedge.exe'" -ErrorAction Stop |
      Where-Object { $_.CommandLine -and $_.CommandLine.ToLower().Contains($needle) })
  } catch { return @() }
}

function Initialize-Win32 {
  if ('MosqueClockWin32' -as [type]) { return }
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class MosqueClockWin32 {
  [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags);
  public static uint IdleSeconds() {
    LASTINPUTINFO i = new LASTINPUTINFO(); i.cbSize = (uint)Marshal.SizeOf(i);
    if (!GetLastInputInfo(ref i)) return 0;
    return ((uint)Environment.TickCount - i.dwTime) / 1000;
  }
  public static uint ForegroundPid() { uint pid; GetWindowThreadProcessId(GetForegroundWindow(), out pid); return pid; }
}
'@
}

function Invoke-BringToFront($procs) {
  $ids = @($procs | ForEach-Object { [uint32]$_.ProcessId })
  if ($ids.Count -eq 0) { return }
  $fg = [MosqueClockWin32]::ForegroundPid()
  if ($ids -contains $fg) { return }
  foreach ($id in $ids) {
    $p = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($p -and $p.MainWindowHandle -ne [IntPtr]::Zero) {
      $h = $p.MainWindowHandle
      if ([MosqueClockWin32]::IsIconic($h)) { [MosqueClockWin32]::ShowWindow($h, 9) | Out-Null }
      # ويندوز يمنع برنامجاً في الخلفية من أخذ الواجهة؛ ضغطة Alt وهمية ترفع هذا القيد
      [MosqueClockWin32]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
      [MosqueClockWin32]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
      [MosqueClockWin32]::SetForegroundWindow($h) | Out-Null
      Write-Log "brought clock window to front (pid $id)"
      return
    }
  }
}

function Repair-BrowserProfile {
  # بعد انقطاع الكهرباء يظن المتصفح أنه انهار فيعرض «استعادة الصفحات»؛ نصحّح العلامة قبل الفتح
  $pref = Join-Path $BrowserProfile 'Default\Preferences'
  if (Test-Path $pref) {
    try {
      $t = [IO.File]::ReadAllText($pref)
      $t2 = $t.Replace('"exited_cleanly":false', '"exited_cleanly":true').Replace('"exit_type":"Crashed"', '"exit_type":"Normal"')
      if ($t2 -ne $t) { [IO.File]::WriteAllText($pref, $t2) }
    } catch {}
  }
}

function Start-ClockServer {
  $node = Find-Node
  if (-not $node) { Write-Log 'Node.js not found: opening index.html directly'; return $false }
  if (Test-Port $Port) { return $true }
  if (Test-Path $PinFile) { $env:CLOCK_PIN = (Get-Content $PinFile -Raw).Trim() }
  $p = Start-Process -FilePath $node -ArgumentList ('"' + (Join-Path $Root 'server.js') + '"') -WorkingDirectory $Root -WindowStyle Hidden -PassThru
  Set-Content -Path $ServerPidFile -Value $p.Id
  Write-Log "started server.js (pid $($p.Id))"
  for ($i = 0; $i -lt 40; $i++) { if (Test-Port $Port) { return $true }; Start-Sleep -Milliseconds 500 }
  Write-Log 'server did not answer on port 8080: opening index.html directly'
  return $false
}

function Invoke-Run {
  $created = $false
  $mutex = [System.Threading.Mutex]::new($true, 'Local\MosqueClockLauncher', [ref]$created)
  if (-not $created) { Write-Log 'launcher already running'; return }
  if (Test-Path $StopFlag) { Remove-Item -Force $StopFlag }
  Initialize-Win32
  Write-Log "launcher start (root: $Root)"
  Start-Sleep -Seconds 6   # مهلة لاكتمال سطح المكتب بعد تسجيل الدخول
  $cfg = Get-Config
  $browser = Find-Browser
  if (-not $browser) {
    Write-Log 'no Chrome/Edge found'
    Show-Message 'لم أجد متصفح Chrome أو Edge على هذا الجهاز. ثبّت Google Chrome ثم أعد تشغيل الجهاز.' 'ساعة المسجد' 'OK' 'Error' | Out-Null
    return
  }
  $useServer = Start-ClockServer
  if ($useServer) { $url = "http://localhost:$Port/index.html?kiosk=1" }
  else { $url = ([Uri](Join-Path $Root 'index.html')).AbsoluteUri + '?kiosk=1' }
  $failures = 0
  while ($true) {
    if (Test-Path $StopFlag) { break }
    # منع السكون وإطفاء الشاشة ما دامت الساعة تعمل: ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED
    [MosqueClockWin32]::SetThreadExecutionState([uint32]2147483651) | Out-Null
    Repair-BrowserProfile
    $bargs = @('--kiosk', $url, ('--user-data-dir="' + $BrowserProfile + '"'), '--no-first-run', '--no-default-browser-check',
      '--noerrdialogs', '--disable-session-crashed-bubble', '--disable-infobars', '--autoplay-policy=no-user-gesture-required',
      '--disable-features=Translate,TranslateUI,HardwareMediaKeyHandling', '--overscroll-history-navigation=0', '--disable-pinch',
      '--check-for-update-interval=31536000', '--disable-background-timer-throttling', '--disable-renderer-backgrounding')
    if ($browser.kind -eq 'edge') { $bargs += @('--edge-kiosk-type=fullscreen', '--no-first-run') }
    $started = Get-Date
    try { Start-Process -FilePath $browser.path -ArgumentList $bargs | Out-Null; Write-Log "opened $($browser.kind): $url" }
    catch { Write-Log "failed to start browser: $_" }
    Start-Sleep -Seconds 8
    # المتصفح قد يغيّر رقم عمليته (تحديث مثلاً)، فنراقب كل عملياته بملف التعريف الخاص
    while ($true) {
      if (Test-Path $StopFlag) { break }
      $procs = Get-KioskProcesses
      if ($procs.Count -eq 0) { break }
      [MosqueClockWin32]::SetThreadExecutionState([uint32]2147483651) | Out-Null
      if ($cfg.frontIdleMinutes -gt 0 -and [MosqueClockWin32]::IdleSeconds() -ge ($cfg.frontIdleMinutes * 60)) { Invoke-BringToFront $procs }
      if ($useServer -and -not (Test-Port $Port)) { Write-Log 'server stopped: restarting'; Start-ClockServer | Out-Null }
      Start-Sleep -Seconds 15
    }
    if (Test-Path $StopFlag) { break }
    if (((Get-Date) - $started).TotalSeconds -lt 30) { $failures++ } else { $failures = 0 }
    $wait = [Math]::Min(60, 5 * [Math]::Max(1, $failures))
    Write-Log "browser closed: reopening in $wait s"
    Start-Sleep -Seconds $wait
  }
  Write-Log 'launcher stopped (stop flag)'
  [MosqueClockWin32]::SetThreadExecutionState([uint32]2147483648) | Out-Null
  $mutex.ReleaseMutex()
}

function Stop-Clock {
  Set-Content -Path $StopFlag -Value (Get-Date)
  Get-KioskProcesses | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }
  if (Test-Path $ServerPidFile) {
    $id = (Get-Content $ServerPidFile -Raw).Trim()
    $p = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($p -and $p.ProcessName -like 'node*') { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
    Remove-Item -Force $ServerPidFile -ErrorAction SilentlyContinue
  }
  Write-Log 'stopped by user'
}

function Get-InstallState {
  $t = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($t) { return 'task' }
  if (Test-Path $StartupLnk) { return 'startup' }
  return 'none'
}

function Invoke-Install {
  $browser = Find-Browser
  if (-not $browser) {
    Show-Message "لم أجد Google Chrome ولا Microsoft Edge.`nثبّت Chrome ثم شغّل هذا الملف مرة أخرى." 'ساعة المسجد' 'OK' 'Error' | Out-Null
    exit 1
  }
  if ($FrontIdleMinutes -ge 0) { @{ frontIdleMinutes = $FrontIdleMinutes } | ConvertTo-Json | Set-Content -Path $ConfigFile -Encoding UTF8 }
  elseif (-not (Test-Path $ConfigFile)) { @{ frontIdleMinutes = 2 } | ConvertTo-Json | Set-Content -Path $ConfigFile -Encoding UTF8 }

  # مُشغّل مخفي بلا نافذة سوداء
  $ps1 = Join-Path $Here 'mosque-clock.ps1'
  $cmd = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""' + $ps1 + '"" -Action run'
  Set-Content -Path $Vbs -Encoding Unicode -Value ('CreateObject("WScript.Shell").Run "' + $cmd + '", 0, False')

  $method = 'none'
  try {
    $act = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('"' + $Vbs + '"')
    $trg = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
    $set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    $prn = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $TaskName -Action $act -Trigger $trg -Settings $set -Principal $prn -Description 'Mosque Clock kiosk autostart' -Force -ErrorAction Stop | Out-Null
    $method = 'task'
    if (Test-Path $StartupLnk) { Remove-Item -Force $StartupLnk }
  } catch {
    Write-Log "scheduled task failed ($_): using Startup folder"
    $sh = New-Object -ComObject WScript.Shell
    $l = $sh.CreateShortcut($StartupLnk)
    $l.TargetPath = 'wscript.exe'; $l.Arguments = '"' + $Vbs + '"'; $l.WorkingDirectory = $Root; $l.Description = 'Mosque Clock'
    $l.Save()
    $method = 'startup'
  }

  # منع السكون وإطفاء الشاشة وشاشة التوقف (على الكهرباء والبطارية)
  foreach ($a in @('monitor-timeout-ac 0', 'standby-timeout-ac 0', 'hibernate-timeout-ac 0', 'monitor-timeout-dc 0', 'standby-timeout-dc 0')) {
    & powercfg.exe /change $a.Split(' ')[0] $a.Split(' ')[1] 2>$null | Out-Null
  }
  try {
    Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name ScreenSaveActive -Value '0'
    Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name ScreenSaverIsSecure -Value '0'
  } catch {}
  Write-Log "installed ($method)"

  $auto = $false
  try { $auto = ((Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -ErrorAction Stop).AutoAdminLogon -eq '1') } catch {}
  $msg = "تم تفعيل التشغيل التلقائي للساعة.`n`n" +
    "• تفتح الساعة بملء الشاشة فوق البرامج عند كل تشغيل للجهاز، وتعود إن أُغلقت.`n" +
    "• أُوقف السكون وإطفاء الشاشة.`n" +
    "• المتصفح: " + $(if ($browser.kind -eq 'chrome') { 'Google Chrome' } else { 'Microsoft Edge' }) + "، والخادم: " + $(if (Find-Node) { 'Node.js (التحكم من الجوال يعمل)' } else { 'بدون (تُفتح الساعة كملف)' }) + "`n" +
    "• للإيقاف المؤقت: stop-clock.bat ، وللإزالة: uninstall-autostart.bat`n`n" +
    "مهم بعد انقطاع الكهرباء:`n" +
    "١) في إعدادات BIOS فعّل: Restore on AC Power Loss = Power On`n"
  if ($auto) { $msg += "٢) الدخول التلقائي لويندوز مفعّل ✓" ; Show-Message $msg | Out-Null }
  else {
    $msg += "٢) الدخول التلقائي لويندوز غير مفعّل: بدونه تتوقف الأمور عند شاشة كلمة المرور.`n`nهل تريد فتح نافذة netplwiz الآن لإلغاء طلب كلمة المرور؟"
    if ((Show-Message $msg 'ساعة المسجد' 'YesNo' 'Question') -eq 'Yes') { Start-Process netplwiz.exe }
  }
  if (-not $NoStart) { Start-Process -FilePath 'wscript.exe' -ArgumentList ('"' + $Vbs + '"') }
}

function Invoke-Uninstall {
  Stop-Clock
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  if (Test-Path $StartupLnk) { Remove-Item -Force $StartupLnk }
  Write-Log 'uninstalled'
  Show-Message 'أُزيل التشغيل التلقائي للساعة. (إعدادات الطاقة لم تُغيَّر، أعدها من لوحة التحكم إن أردت.)' | Out-Null
}

switch ($Action) {
  'install'   { Invoke-Install }
  'uninstall' { Invoke-Uninstall }
  'stop'      { Stop-Clock; Show-Message 'أُوقفت الساعة. ستعمل تلقائياً عند التشغيل القادم للجهاز، أو شغّلها الآن من start-clock.bat' | Out-Null }
  'run'       { Invoke-Run }
  'status'    {
    $state = Get-InstallState
    $running = (Get-KioskProcesses).Count -gt 0
    @{ platform = 'windows'; installed = ($state -ne 'none'); method = $state; running = $running; browser = $(if ($b = Find-Browser) { $b.kind } else { $null }); log = $LogFile } | ConvertTo-Json -Compress
  }
}
