' hidden-run.vbs — run a target script COMPLETELY hidden.
' wscript.exe is a GUI-subsystem binary, so a scheduled task that launches
' it opens no console at all — before this, every minute-level tick flashed
' a cmd window open/closed on the desktop (and while a shim blocked, its
' window stayed parked open).
'
' Usage: wscript.exe hidden-run.vbs "C:\path\to\target.cmd"
Option Explicit
Dim sh
If WScript.Arguments.Count < 1 Then WScript.Quit 1
Set sh = CreateObject("WScript.Shell")
sh.Run """" & WScript.Arguments(0) & """", 0, False
