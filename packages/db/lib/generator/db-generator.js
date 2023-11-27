'use strict'

const { BaseGenerator, generateTests, addPrefixToEnv } = require('@platformatic/generators')
const { jsHelperSqlite, jsHelperMySQL, jsHelperPostgres, moviesTestTS, moviesTestJS } = require('./code-templates')
const { join } = require('node:path')
class DBGenerator extends BaseGenerator {
  constructor (opts = {}) {
    super(opts)
    this.type = 'db'
    this.connectionStrings = {
      postgres: 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
      sqlite: 'sqlite://./db.sqlite',
      mysql: 'mysql://root@127.0.0.1:3306/platformatic',
      mariadb: 'mysql://root@127.0.0.1:3306/platformatic'
    }
  }

  getDefaultConfig () {
    const defaultBaseConfig = super.getDefaultConfig()
    return {
      ...defaultBaseConfig,
      database: 'sqlite',
      connectionString: null,
      types: false,
      migrations: 'migrations',
      createMigrations: true,
      applyMigrations: false
    }
  }

  async _getConfigFileContents () {
    const { typescript, isRuntimeContext, envPrefix = '', migrations, plugin, types } = this.config
    const version = this.platformaticVersion
    const connectionStringValue = envPrefix ? `PLT_${envPrefix}_DATABASE_URL` : 'DATABASE_URL'
    const config = {
      $schema: `https://platformatic.dev/schemas/v${version}/db`,
      db: {
        connectionString: `{${connectionStringValue}}`,
        graphql: true,
        openapi: true,
        schemalock: true
      },
      watch: {
        ignore: ['*.sqlite', '*.sqlite-journal']
      }
    }

    if (!isRuntimeContext) {
      config.server = {
        hostname: '{PLT_SERVER_HOSTNAME}',
        port: '{PORT}',
        logger: {
          level: '{PLT_SERVER_LOGGER_LEVEL}'
        }
      }
    }

    if (migrations) {
      config.migrations = {
        dir: migrations
      }
    }

    if (plugin === true) {
      config.plugins = {
        paths: [{
          path: './plugins',
          encapsulate: false
        }, {
          path: './routes'
        }]
      }
    }

    if (types === true) {
      config.types = {
        autogenerate: true
      }
    }
    if (typescript === true && config.plugins) {
      config.plugins.typescript = true
    }

    return config
  }

  async _beforePrepare () {
    this.config.connectionString = this.config.connectionString || this.connectionStrings[this.config.database]
    this.config.dependencies = {
      '@platformatic/db': `^${this.platformaticVersion}`
    }

    if (this.config.isRuntimeContext) {
      this.config.env = {
        DATABASE_URL: this.connectionStrings[this.config.database]
      }
      this.config.env = addPrefixToEnv(this.config.env, this.config.envPrefix)
    } else {
      this.config.env = {
        PLT_SERVER_HOSTNAME: this.config.hostname,
        PLT_SERVER_LOGGER_LEVEL: 'info',
        PORT: 3042,
        DATABASE_URL: this.connectionStrings[this.config.database],
        ...this.config.env
      }
    }
  }

  async _afterPrepare () {
    if (this.config.createMigrations) {
      this.createMigrationFiles()
    }

    if (this.config.plugin) {
      let jsHelper = { pre: '', config: '', post: '' }
      switch (this.config.database) {
        case 'sqlite':
          jsHelper = jsHelperSqlite
          break
        case 'mysql':
          jsHelper = jsHelperMySQL(this.config.connectionString)
          break
        case 'postgres':
          jsHelper = jsHelperPostgres(this.config.connectionString)
          break
        case 'mariadb':
          jsHelper = jsHelperMySQL(this.config.connectionString)
          break
      }
      // await generatePlugins(logger, currentDir, typescript, 'db', jsHelper)

      if (this.config.createMigrations) {
        if (this.config.typescript) {
          this.addFile({ path: join('test', 'routes'), file: 'movies.test.ts', contents: moviesTestTS })
        } else {
          this.addFile({ path: join('test', 'routes'), file: 'movies.test.js', contents: moviesTestJS })
        }
      }

      // TODO(leorossi): this is unfortunate. We have already generated tests in BaseGenerator
      // next line will override the test files
      generateTests(this.config.typescript, this.type, jsHelper).forEach((fileObject) => {
        this.addFile(fileObject)
      })

      if (this.config.isRuntimeContext) {
        // remove .env file and env variables since they are all for the config.server property
        const envFile = this.getFileObject('.env')
        if (envFile) {
          envFile.contents = ''
        }
      }
    }
  }

  createMigrationFiles () {
    this.addFile({ path: 'migrations', file: '001.do.sql', contents: this.getMoviesMigrationDo() })
    this.addFile({ path: 'migrations', file: '001.undo.sql', contents: this.getMoviesMigrationUndo() })
  }

  getMoviesMigrationDo () {
    const key = {
      postgres: 'SERIAL',
      sqlite: 'INTEGER',
      mysql: 'INTEGER UNSIGNED AUTO_INCREMENT',
      mariadb: 'INTEGER UNSIGNED AUTO_INCREMENT'
    }

    return `
  -- Add SQL in this file to create the database tables for your API
  CREATE TABLE IF NOT EXISTS movies (
    id ${key[this.config.database]} PRIMARY KEY,
    title TEXT NOT NULL
  );
  `
  }

  getMoviesMigrationUndo () {
    return '-- Add SQL in this file to drop the database tables\nDROP TABLE movies;'
  }
}

module.exports = DBGenerator
module.exports.DBGenerator = DBGenerator