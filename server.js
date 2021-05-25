require('dotenv').config();
const JWT = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const MQTT = require("async-mqtt");
console.log(process.env.MQTTUSER)
console.log(process.env.MQTTPSW)
console.log(process.env.MQTTSERVER)
const clientMQTT = MQTT.connect(process.env.MQTTSERVER, {
  username: process.env.MQTTUSER,
  password: process.env.MQTTPSW
});


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

const createJwt = (username) => {
  const payload = {
    "context": {
      "user": {
        "avatar": `https://www.gravatar.com/avatar/${username}?d=identicon`,
        "name": username,
        "email": `${username}@casanavarosa.ddns.net`,
        "id": username
      },
      "group": "casanavarosa-citofono"
    },
    "aud": process.env.JTSIAPPID,
    "iss": process.env.JTSIAPPID,
    "sub": "casanavarosa.ddns.net",
    "room": "*",
  };
  return JWT.sign(payload, process.env.JTSIAPPKEY);
}

fastify.get('/citofono', (req, reply) => {
  const secretKey = req.query.secret;
  if (secretKey !== process.env.SECRET) {
    fastify.log.info(`unhauthorized access!!!`, req);
    reply.code(401);
    reply.send({ ok: false });
  } else {

    fastify.log.info({ user: req.query.user });
    const serverUrl = process.env.IODOMAIN || 'https://pcmansardalinux.homenet.telecomitalia.it:3000';
    const username = req.query.user || 'altro';
    const width = req.query.displayw || '100%';
    const height = req.query.displayh || '100%';
    const jwt = createJwt(username);

    reply.view('/templates/citofono.ejs', {
      serverUrl,
      username,
      domain: process.env.DOMAIN || 'pcmansardalinux.homenet.telecomitalia.it',
      width,
      height,
      jwt,
      video:process.env.VIDEO
    })
  }
})

const authApi = (request, reply, done) => {
  try {
    const jwt = request.query.jwt;
    if (!jwt)
      throw new Error("missing jwt token");

    let decoded = JWT.verify(jwt, process.env.JTSIAPPKEY);
    fastify.log.error("user authorized", decoded);
    done();
  } catch (error) {
    fastify.log.error(error);
    reply.code(401);
    reply.send({ ok: false });
    done();
  }

};

fastify.post('/command/doorBell',
  {
    preHandler: authApi,
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
  preHandler: authApi,
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
  preHandler: authApi,
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
const handleDoorbellCommand = async () => {
  clearTimeout(doorbellTimer);
  fastify.io.emit('startCall');
  await clientMQTT.publish('citofono/remote', 'https://casanavarosa.ddns.net:3000/citofono?secret=911c7bb8f91e47a4add810d99a8736b4');
  doorbellTimer = setTimeout(() => {
    fastify.io.emit('endCall');
  }, 300000);
}

// Run the server!
const start = async () => {
  try {
    await fastify.listen(process.env.PORT || 3000, "0.0.0.0");
    console.log("started!!!!")
    await clientMQTT.subscribe('citofono/in');
    clientMQTT.on('message', async (_topic, message, packet) => {
      processMqttEvent(message.toString());
    })
  } catch (err) {
    fastify.log.error(err)
    await clientMQTT.end();
  }
}

fastify.addHook('preHandler', (request, reply, done) => {
  // some code
  done()
})

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