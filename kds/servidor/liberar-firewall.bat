@echo off
REM Rode com botao direito > Executar como administrador
netsh advfirewall firewall add rule name="KDS captura impressora 9100" dir=in action=allow protocol=TCP localport=9100
netsh advfirewall firewall add rule name="KDS telas 8080" dir=in action=allow protocol=TCP localport=8080
echo.
echo Portas 9100 e 8080 liberadas no firewall.
pause
