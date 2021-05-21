const Gpio = require('onoff').Gpio;
const lock = new Gpio(27, 'out');
const dorbell = new Gpio(22, 'in', 'rising', { debounceTimeout: 10 });
const MQTT = require("async-mqtt");
const clientMQTT = MQTT.connect('mqtt://casanavarosa.ddns.net')


const exitHandler = async () => {
    console.log('cleaning up......');
    lock.unexport();
    dorbell.unexport();
    await clientMQTT.end();
    process.exit(0);
}

process.on('exit', exitHandler);
//catches ctrl+c event
process.on('SIGINT', exitHandler);
// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler);
process.on('SIGUSR2', exitHandler);

const processMqttEvent = (evt) => {
    console.log(`got ${evt} MQTT event`);
    switch (evt) {
        case 'unlock':
            handleUnlockCommand();
            break;
        default:
            console.log('command not implemented yet')
            break;
    }
}

dorbell.watch(async (err, value) => {
    if (err) {
        throw err;
    }

    console.log(`value of doorbell pin is ${value}`)

    if (value) {
        await clientMQTT.publish('citofono/in', 'doorBell');
    }
});

let doorLockTimer = 0;
const handleUnlockCommand = () => {
    lock.writeSync(1);
    doorLockTimer = setTimeout(() => {
        lock.writeSync(0);
        clearTimeout(doorLockTimer);
    }, 500);
}

const start = async () => {
    try {
        await clientMQTT.subscribe('citofono/ext');
        clientMQTT.on('message', async (_topic, message, packet) => {
            processMqttEvent(message.toString());
        })
    } catch (err) {
        console.error('error connecting...', err);
        await clientMQTT.end();
    }
}

process
  .on('unhandledRejection', (reason, p) => {
    console.error(reason, 'Unhandled Rejection at Promise', p);
  })
  .on('uncaughtException', err => {
    console.error(err, 'Uncaught Exception thrown');
    process.exit(1);
  });

clientMQTT.on("connect", start);