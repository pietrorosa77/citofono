
function debounce(func, wait, immediate) {
    let timeout;
    return function () {
        let context = this, args = arguments;
        const later = function () {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};

function showTime($clockElement, oldTimer) {
    if (oldTimer) {
        clearTimeout(oldTimer);
    }
    const date = new Date();
    let h = date.getHours(); // 0 - 23
    let m = date.getMinutes(); // 0 - 59
    let s = date.getSeconds(); // 0 - 59

    if (h == 0) {
        h = 12;
    }


    h = (h < 10) ? "0" + h : h;
    m = (m < 10) ? "0" + m : m;
    s = (s < 10) ? "0" + s : s;

    const time = `${h}:${m}:${s}`;
    $clockElement.text(time);
    $clockElement.addClass("clock");

    let timer = setTimeout(() => showTime($clockElement, timer), 1000);
}

const micMuteclass = "bi-mic-mute-fill";
const micSound = "bi-mic-fill";


class Citofono {
    constructor(options) {
        this.$ = options.$;
        this.options = options;
        this.socket = this.options.io(options.ioAddress);
        this.connected = false;

        this.btnConnect = this.$("#btnConnect");
        this.btnDoorUnlock = this.$("#btnDoorUnlock");
        this.btnHangup = this.$("#btnHangup");
        this.btnMic = this.$("#btnMic");
        this.clock = this.$("#clock");
        showTime(this.clock);
        this.btnConnect.on('click', debounce(this.manualStartCall, 1000, true));
        this.btnDoorUnlock.on('click', debounce(this.openDoor, 1000, true));
        this.btnHangup.on('click', debounce(() => this.executeJitsiMeetApiCommand("hangup"), 1000, true));
        this.btnMic.on('click', debounce(() => {
            this.executeJitsiMeetApiCommand("toggleAudio");
            setTimeout(() => {
                this.jitsiApi.isAudioMuted().then(muted => {
                    this.setMicButtonStatus(muted);
                });
            },500);

        }, 1000, true));
        window.addEventListener("beforeunload", this.endCall);

        if (this.socket) {
            this.socket.onAny((event) => {
                if (this[event]) {
                    this[event]();
                }
            });
        }
    }

    startCall = () => {
        if (!this.connected) {
            const isExternalUnit = this.options.userName === 'esterno';
            const apiOpts = {
                width: 320,
                height: 430,
                parentNode: document.querySelector('#meetFrame'),
                roomName: 'citofono',
                interfaceConfigOverwrite: { TILE_VIEW_MAX_COLUMNS: 2 },
                configOverwrite: {
                    startWithAudioMuted: !isExternalUnit,
                    startWithVideoMuted: !isExternalUnit,
                    disableDeepLinking: true,
                    toolbarButtons: [] //['microphone', 'tileview', 'filmstrip', 'hangup']
                },
                userInfo: {
                    email: 'navarosa@navarosa.com',
                    displayName: this.options.userName
                }
            };

            this.jitsiApi = new this.options.jitsiApi(this.options.domain, apiOpts);
            this.jitsiApi.addListener("readyToClose", this.endCall);
            this.connected = true;

            console.log("starting call..");
            this.setButtonsOnCall(!isExternalUnit);
        } else {
            console.log("a call is already in progress....");
        }

    }

    endCall = () => {
        if (this.jitsiApi && this.connected) {
            console.log("hanging up the call....")
            this.jitsiApi.removeEventListener("readyToClose", this.endCall);
            this.jitsiApi.dispose();
            this.setButtonsOffCall();
            this.connected = false;
            this.$.post(`${this.options.serverUrl}/command/endCall`, function (data) {
                console.log("remot unit command hangup sent", data);
            });
        } else {
            console.log("0 active calls....");
        }
    }

    executeJitsiMeetApiCommand = (command) => {
        this.jitsiApi.executeCommand(command);
    }

    setButtonsOnCall = (muted) => {
        this.$(".offcall").hide();
        this.setMicButtonStatus(muted);
        this.$(".oncall").show();
    }

    setButtonsOffCall = () => {
        this.$(".offcall").show();
        this.$(".oncall").hide();
        this.btnMic.removeClass('btn-secondary btn-success');
        this.btnMic.find('i').removeClass('bi-mic-mute-fill bi-mic-fill');
    }

    setMicButtonStatus = (muted) => {
        const $btnIcon = this.btnMic.find('i');
        if(muted) {
            this.btnMic.addClass('btn-secondary').removeClass('btn-success');
            $btnIcon.addClass('bi-mic-mute-fill').removeClass('bi-mic-fill');
        } else {
            this.btnMic.removeClass('btn-secondary').addClass('btn-success');
            $btnIcon.removeClass('bi-mic-mute-fill').addClass('bi-mic-fill');
        }
    }

    openDoor = () => {
        this.$.post(`${this.options.serverUrl}/command/unlock`, function (data) {
            console.log("asking to unlock door", data);
        });
    }

    manualStartCall = () => {
        this.$.post(`${this.options.serverUrl}/command/startCall`, function (data) {
            console.log("manually starting a call", data);
        });
    }
}
