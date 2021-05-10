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
})

fastify.register(require('point-of-view'), {
  engine: {
    ejs: require('ejs')
  }
})

fastify.register(require('fastify-cors'), (instance) => (req, callback) => {
  let corsOptions = { origin: true }
  callback(null, corsOptions) // callback expects two parameters: error and options
})

fastify.register(require('fastify-static'), {
  root: path.join(__dirname, 'public'),
})


fastify.get('/citofono', (req, reply) => {
  fastify.log.info("porta" + process.env.PORT)
  fastify.log.info({ command: req.query.user });
  const socketIoUrl = req.query.user === 'cancello' ? `${process.env.HTTPS ? 'https' : 'http'}://localhost:${process.env.PORT}` : null;
  reply.view('/templates/citofono.ejs', { socketIoUrl, remoteControlled: process.env.REMOTE_CONTROLLED, username: req.query.user || 'esterno' })
})

fastify.post('/command/unlock', (req, reply) => {
  fastify.log.info("apri cancello");
  reply.send({ ok: true })
})

fastify.post('/command/:command', (req, reply) => {
  fastify.log.info({ command: req.params.command });
  fastify.io.emit(req.params.command);
  reply.send({ ok: true })
})

fastify.setErrorHandler(function (error, request, reply) {
  // Log error
  fastify.log.error(error)
  // Send error response
  reply.status(500).send({ ok: false })
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