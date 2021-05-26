
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

    const time = `${h}:${m}`;
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
        this.jwt=options.jwt;
        this.socket = this.options.io(options.ioAddress);
        this.connected = false;
        this.isExternalUnit = this.options.userName === 'esterno';
        this.btnConnect = this.$("#btnConnect");
        this.btnDoorUnlock = this.$("#btnDoorUnlock");
        this.btnHangup = this.$("#btnHangup");
        this.btnVideo=this.$("#btnVideo");
        this.restartBtn=this.$("#rebootExternal");
        this.btnMic = this.$("#btnMic");
        this.clock = this.$("#clock");
        showTime(this.clock);
        this.btnConnect.on('click', debounce(this.manualStartCall, 1000, true));
        this.btnDoorUnlock.on('click', debounce(() => this.executeMqttCommand("unlock"), 1000, true));
        this.btnVideo.on('click', debounce(this.manageVideo, 200, true));
        this.btnHangup.on('click', debounce(() => this.executeJitsiMeetApiCommand("hangup"), 1000, true));
        this.btnMic.on('click', debounce(() => this.executeJitsiMeetApiCommand("toggleAudio"), 1000, true));
        this.restartBtn.on('click', debounce(() => this.executeMqttCommand("reboot"), 1000, true));
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
            const apiOpts = {
                width: '100%',
                height: '100%',
                jwt:this.jwt,
                parentNode: document.querySelector('#meetFrame'),
                roomName: 'citofono',
                interfaceConfigOverwrite: { TILE_VIEW_MAX_COLUMNS: 2 },
                configOverwrite: {
                    startWithAudioMuted: !this.isExternalUnit,
                    startWithVideoMuted: true,
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
            this.jitsiApi.addListener("audioMuteStatusChanged", this.muteStatusChanged);
            this.jitsiApi.addListener("videoConferenceJoined", this.callJoined);
            this.jitsiApi.addListener("participantLeft", this.partecipantLeft);
            this.connected = true;

            console.log("starting call..");
            this.toggleButtonStatus(this.btnConnect,true);
        } else {
            console.log("a call is already in progress....");
        }

    }

    endCall = () => {
        if (this.jitsiApi && this.connected) {
            console.log("hanging up the call....")
            this.jitsiApi.removeEventListener("readyToClose", this.endCall);
            this.jitsiApi.removeEventListener("audioMuteStatusChanged", this.muteStatusChanged);
            this.jitsiApi.removeEventListener("videoConferenceJoined", this.callJoined);
            this.jitsiApi.dispose();
            this.setButtonsOffCall();
            this.connected = false;
        } else {
            console.log("0 active calls....");
        }
    }

    partecipantLeft = () => {
        const totPartecipants =  this.jitsiApi.getNumberOfParticipants();
        if(totPartecipants < 2) {
            this.executeJitsiMeetApiCommand("hangup");
        }
    }

    executeJitsiMeetApiCommand = (command) => {
        this.jitsiApi.executeCommand(command);
    }

    muteStatusChanged = (args) => {
        console.log("mute status changed", args)
        this.setMicButtonStatus(args.muted);
    }

    manageVideo = () => {
        const on = !this.btnVideo.hasClass('btn-success');
        const url = on? this.options.videoUrl : '';
        this.$("#videoframe").attr('src',url);
        if(on) {
            this.$("#cameravd").fadeIn();
        } else {
            this.$("#cameravd").fadeOut();
        }

        this.setVideoButtonStatus(on);
    }

    callJoined = (args) => {
        console.log("call joined", args);
        this.setButtonsOnCall(!this.isExternalUnit);
    }

    toggleButtonStatus = (btn, disabled) => {
        btn.prop("disabled", disabled);
    }

    setButtonsOnCall = (muted) => {
        this.$(".offcall").hide();
        this.setMicButtonStatus(muted);
        this.$(".oncall").show();
    }

    setButtonsOffCall = () => {
        this.$(".offcall").show();
        this.$(".oncall").hide();
        this.toggleButtonStatus(this.btnConnect,false);
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

    setVideoButtonStatus = (on) => {
        const $btnIcon = this.btnVideo.find('i');
        if(!on) {
            this.btnVideo.addClass('btn-secondary').removeClass('btn-success');
            $btnIcon.addClass('bi-camera-video-off-fill').removeClass('bi-camera-video-fill');
        } else {
            this.btnVideo.removeClass('btn-secondary').addClass('btn-success');
            $btnIcon.removeClass('bi-camera-video-off-fill').addClass('bi-camera-video-fill');
        }
    }

    executeMqttCommand = (command) => {
        this.$.post(`${this.options.serverUrl}/mqtt/${command}?jwt=${this.jwt}`, function (data) {
            console.log("asking to execute mqtt command", command);
        });
    }


    manualStartCall = () => {
        this.$.post(`${this.options.serverUrl}/command/startCall?jwt=${this.jwt}`, function (data) {
            console.log("manually starting a call", data);
        });
    }
}
