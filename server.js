const path = require('path');
const fs = require('fs');
require('dotenv').config()

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
  reply.view('/templates/citofono.ejs', {
    serverUrl,
    username,
    domain: process.env.DOMAIN || 'pcmansardalinux.homenet.telecomitalia.it',
  })
})

let doorbellTimer = 0;
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
    clearTimeout(doorbellTimer);
    fastify.io.emit('startCall');
    doorbellTimer = setTimeout(() => {
      fastify.io.emit('endCall');
    }, 60000)
    reply.send({ ok: true })
  })

fastify.post('/command/unlock', {
  config: {
    rateLimit: {
      max: 1,
      timeWindow: '3 seconds'
    }
  }
}, (req, reply) => {
  fastify.log.info("apri cancello");
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
})

// Run the server!
const start = async () => {
  try {
    await fastify.listen(process.env.PORT || 3000, "0.0.0.0")
  } catch (err) {
    fastify.log.error(err)
    //process.exit(1)
  }
}


start();