
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

function showTime($clockElement, oldTimer){
    if(oldTimer) {
        clearTimeout(oldTimer);
    }
    const date = new Date();
    let h = date.getHours(); // 0 - 23
    let m = date.getMinutes(); // 0 - 59
    let s = date.getSeconds(); // 0 - 59
    
    if(h == 0){
        h = 12;
    }
    
    
    h = (h < 10) ? "0" + h : h;
    m = (m < 10) ? "0" + m : m;
    s = (s < 10) ? "0" + s : s;
    
    const time = `${h}:${m}:${s}`;
    $clockElement.text(time);
    $clockElement.addClass("clock");
    
    let timer = setTimeout(() => showTime($clockElement,timer), 1000);  
}


class Citofono {
    constructor(options) {
        this.$ = options.$;
        this.options = options;
        this.socket = this.options.io(options.ioAddress);
        this.connected = false;

        this.btnConnect = this.$("#btnConnect");
        this.btnDoorUnlock = this.$("#btnDoorUnlock");
        this.clock = this.$("#clock");
        showTime(this.clock);
        this.btnConnect.on('click', debounce(this.manualStartCall, 5000, true));
        this.btnDoorUnlock.on('click', debounce(this.openDoor, 5000, true));
        window.addEventListener("beforeunload", this.hangUp);

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
                    toolbarButtons: ['microphone', 'tileview', 'settings', 'filmstrip', 'hangup']
                },
                userInfo: {
                    email: 'navarosa@navarosa.com',
                    displayName: this.options.userName
                }
            };

            this.jitsiApi = new this.options.jitsiApi(this.options.domain, apiOpts);
            this.jitsiApi.addListener("readyToClose", this.hangUp);
            this.connected = true;
            this.disableCallButton();
        }

    }

    hangUp = () => {
        if (this.jitsiApi && this.connected) {
            this.jitsiApi.removeEventListener("readyToClose", this.hangUp);
            this.jitsiApi.dispose();
            this.enableCallButton();
            this.connected = false;
            this.$.post(`${this.options.serverUrl}/command/hangUp`, function (data) {
                console.log("remot unit command hangup sent", data);
            }); 
        }
    }

    disableCallButton = () => {
        this.btnConnect.prop("disabled", true);
        this.btnConnect.addClass("btn-success");
        
    }

    enableCallButton = () => {
        this.btnConnect.prop("disabled", false);
        this.btnConnect.removeClass("btn-success");
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
