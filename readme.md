journalctl --since "2021-05-15 15:00 -u noip.service 


/lib/systemd/system/noip.service


journalctl --since "2021-04-23 11:28"  -u seren.service 
sudo systemctl restart seren.service 
sudo systemctl edit seren.service 
systemctl daemon-reload

[Unit]
Description=Seren deamon

[Service]
Type=simple
User=pi
ExecStart=seren -n esterno -C 0 -d plughw:0,0 -a
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=%n
Restart=on-failure
RestartSec=5s
Environment="TERM=xterm-256color"

[Install]
WantedBy=multi-user.target


/usr/local/etc/no-ip2.conf

4,jr,fEk3dv;_u^


RICORDARSI DI SETTARE SU HOSTS corrispondenza casanavarosa.ddns.net e 198.0.1.126 (PC MANSARDA)