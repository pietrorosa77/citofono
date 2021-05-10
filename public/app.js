
const defaultOptions = {
    roomName: 'citofonot',
    width: 320,
    height: 350,
    parentNode: document.querySelector('#meetFrame'),
    interfaceConfigOverwrite: { TILE_VIEW_MAX_COLUMNS: 2 },
    configOverwrite: {
        startWithAudioMuted: true,
        startWithVideoMuted: true,
        toolbarButtons: ['microphone', 'tileview', 'settings', 'filmstrip']
    },
};
const domain = 'pcmansardalinux.homenet.telecomitalia.it';

function debounce(func, wait, immediate) {
    var timeout;
    return function () {
        var context = this, args = arguments;
        var later = function () {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};

const commands = {
    mute: "mute",
    unmute: "unmute",
    openCam: "openCam",
    closeCam: "closeCam",
    unlock: "unlock"
}

class Citofono {
    constructor($, api, io, ioAddress, remoteControlled, username) {
        this.$ = $;
        this.io = io;
        this.api = api;
        this.socket = ioAddress ? this.io(ioAddress) : null;
        this.remoteControlled = remoteControlled || 'citofonoext.homenet.telecomitalia.it';

        this.btnTalk = this.$("#btnTalk");
        this.btnView = this.$("#btnView");
        this.btnDoor = this.$("#btnDoor");

        this.setButtonStateFromCommand(this.btnTalk, commands.mute);
        this.setButtonStateFromCommand(this.btnView, commands.closeCam);
        this.setButtonStateFromCommand(this.btnDoor, commands.unlock);

        const clickEvent = debounce((e) => {
            const command = $(e.currentTarget).data("command");
            this.execUICommand(command);
        }, 1000, true);

        this.btnTalk.on('click', clickEvent);
        this.btnView.on('click', clickEvent);
        this.btnDoor.on('click', clickEvent);

        this.connect(username);

        if (this.socket) {
            this.socket.onAny((event) => {
                if (this[event]) {
                    this[event]();
                }
            });
        }
    }

    getButtonStateFromCommand = (selCommand) => {
        let ret = {
            addClass: "",
            removeClass: "",
            command: "",
            addIconClass: "",
            removeIconClass: ""
        }

        switch (selCommand) {
            case commands.unmute:
                ret.command = commands.mute;
                ret.addClass = "btn-success";
                ret.removeClass = "btn-secondary";
                ret.addIconClass = "bi-mic-fill";
                ret.removeIconClass = "bi-mic-mute-fill";
                break;
            case commands.mute:
                ret.command = commands.unmute;
                ret.addClass = "btn-secondary";
                ret.removeClass = "btn-success";
                ret.addIconClass = "bi-mic-mute-fill";
                ret.removeIconClass = "bi-mic-fill";
                break;
            case commands.openCam:
                ret.command = commands.closeCam;
                ret.addClass = "btn-success";
                ret.removeClass = "btn-secondary";
                ret.addIconClass = "bi-eye-fill";
                ret.removeIconClass = "bi-eye-slash-fill";
                break;
            case commands.closeCam:
                ret.command = commands.openCam;
                ret.addClass = "btn-secondary";
                ret.removeClass = "btn-success";
                ret.addIconClass = "bi-eye-slash-fill";
                ret.removeIconClass = "bi-eye-fill";
                break;
            case commands.unlock:
                ret.command = commands.unlock;
                ret.addClass = "";
                ret.removeClass = "";
                ret.addIconClass = "";
                ret.removeIconClass = "bi";
                break;
        }

        return ret;
    }


    setButtonStateFromCommand = (btn, command) => {
        const newState = this.getButtonStateFromCommand(command);
        btn.addClass(newState.addClass);
        btn.removeClass(newState.removeClass);
        btn.data("command", newState.command);
        const icon = btn.find("i");
        icon.addClass(newState.addIconClass);
        icon.removeClass(newState.removeIconClass);
    }

    connect = (displayName) => {

        this.$(window).on("beforeunload", this.disconnect());

        const apiOpts = {
            ...defaultOptions,
            userInfo: {
                email: 'navarosa@navarosa.com',
                displayName
            }
        }
        this.jitsiApi = new this.api(domain, apiOpts);
        this.jitsiApi.addListener("readyToClose", this.disconnect);

    }

    disconnect = () => {
        if (this.jitsiApi) {
            this.jitsiApi.removeListener("readyToClose", this.disconnect);
            this.$(window).off("beforeunload", this.disconnect());
            this.jitsiApi.dispose();
        }
    }

    controlRemote = (command) => {
        if (this.remoteControlled) {
            this.$.post(`${this.remoteControlled}/command/${command}`, function (data) {
                console.log("remot unit command sent", command, data);
            });
        }
    }

    execUICommand = (command) => {
        this.controlRemote(command);
        this[command]();
    }

    mute = () => {
        this.jitsiApi.isAudioMuted().then(muted => {
            if (!muted) {
                this.jitsiApi.executeCommand("toggleAudio");
            }
            this.setButtonStateFromCommand(this.btnTalk, commands.mute);
        });
    }

    unmute = () => {
        this.jitsiApi.isAudioMuted().then(muted => {
            if (muted) {
                this.jitsiApi.executeCommand("toggleAudio");
            }
            this.setButtonStateFromCommand(this.btnTalk, commands.unmute);
        });
    }

    openCam = () => {

        this.jitsiApi.isVideoMuted().then(muted => {
            if (muted) {
                const result = this.jitsiApi.executeCommand("toggleVideo");
            }
            this.setButtonStateFromCommand(this.btnView, commands.openCam);
        });
    }

    closeCam = () => {
        this.jitsiApi.isVideoMuted().then(muted => {
            if (!muted) {
                this.jitsiApi.executeCommand("toggleVideo")
            }
            this.setButtonStateFromCommand(this.btnView, commands.closeCam);
        });
    }

    unlock = () => {
        //here we just call the remote unit to unlock.
        // maybe send ui notification
    }
}
