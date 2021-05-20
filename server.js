const path = require('path');
const fs = require('fs');
const MQTT = require("async-mqtt");
const clientMQTT = MQTT.connect('mqtt://casanavarosa.ddns.net')
require('dotenv').config();

const fastifyOpts = {
  logger: true
}

if (process.env.HTTPS) {
  fastifyOpts.https = {
    key: fs.readFileSync(path.join(__dirname, 'citofono.key')),
    cert: fs.readFileSync(path.join(__dirname, 'citofono.crt'))
  }
}

const fastify = require('fastify')(fastifyOpts)

fastify.register(require('fastify-socket.io'), {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

fastify.register(require('fastify-rate-limit'), {
  global: false,
  max: 10,
  timeWindow: '1 seconds'
})

fastify.register(require('point-of-view'), {
  engine: {
    ejs: require('ejs')
  }
});

fastify.register(require('fastify-cors'), (instance) => (req, callback) => {
  let corsOptions = { origin: true }
  callback(null, corsOptions) // callback expects two parameters: error and options
});

fastify.register(require('fastify-static'), {
  root: path.join(__dirname, 'public'),
});


fastify.get('/citofono', (req, reply) => {
  fastify.log.info("porta" + process.env.PORT)
  fastify.log.info({ command: req.query.user });
  const serverUrl = process.env.IODOMAIN || 'https://pcmansardalinux.homenet.telecomitalia.it:3000';
  const username = req.query.user || 'altro';
  const width = req.query.displayw || '100%';
  const height = req.query.displayh || '100%';
  reply.view('/templates/citofono.ejs', {
    serverUrl,
    username,
    domain: process.env.DOMAIN || 'pcmansardalinux.homenet.telecomitalia.it',
    width,
    height
  })
})

fastify.post('/command/doorBell',
  {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 seconds'
      }
    }
  },
  (req, reply) => {
    handleDoorbellCommand();
    reply.send({ ok: true })
  })

fastify.post('/command/unlock', {
  config: {
    rateLimit: {
      max: 1,
      timeWindow: '3 seconds'
    }
  }
}, async (req, reply) => {
  fastify.log.info("apri cancello");
  await clientMQTT.publish('citofono/ext', 'unlock');
  reply.send({ ok: true })
})

fastify.post('/command/:command', {
  config: {
    rateLimit: {
      max: 20,
      timeWindow: '1 seconds'
    }
  }
}, (req, reply) => {
  fastify.log.info({ command: req.params.command });
  fastify.io.emit(req.params.command);
  reply.send({ ok: true })
})

fastify.setErrorHandler(function (error, request, reply) {
  // Log error
  fastify.log.error(error)
  // Send error response
  reply.send({ ok: false })
});

const processMqttEvent = (evt) => {
  fastify.log.info(`got ${evt} MQTT event`);
  switch (evt) {
    case 'doorBell':
      handleDoorbellCommand();
      break;
    default:
      fastify.io.emit(evt);
      break;
  }
}


let doorbellTimer = 0;
const handleDoorbellCommand = () => {
  clearTimeout(doorbellTimer);
  fastify.io.emit('startCall');
  doorbellTimer = setTimeout(() => {
    fastify.io.emit('endCall');
  }, 300000);
}

// Run the server!
const start = async () => {
  try {
    await fastify.listen(process.env.PORT || 3000, "0.0.0.0");
    await clientMQTT.subscribe('citofono/in');
    clientMQTT.on('message', async (_topic, message, packet) => {
      processMqttEvent(message.toString());
    })
  } catch (err) {
    fastify.log.error(err)
    await clientMQTT.end();
  }
}

const exitHandler = async () => {
  console.log('cleaning up......');
  await clientMQTT.end();
  process.exit(0);
}

process.on('exit', exitHandler);
//catches ctrl+c event
process.on('SIGINT', exitHandler);
// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler);
process.on('SIGUSR2', exitHandler);


clientMQTT.on("connect", start);