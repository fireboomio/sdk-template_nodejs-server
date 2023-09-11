import pino from 'pino'

export default pino().child({ component: '@fireboomio/nodejs-server' })
