'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app, options) {
  app.log.trace('trace log')
  app.log.debug('debug log')
  app.log.info('info log')
  app.log.warn('warn log')
  app.log.error('error log')
  app.log.fatal('fatal log')
  app.log.fatal('logs finished')

  app.get('/hello', async () => {
    return { runtime: 'runtime-1', service: 'service-2' }
  })
}
