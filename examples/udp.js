const log4js = require('../lib/log4js');

/*
Run this js then run on terminal :

log5js udp 225.0.0.110 1111

or run default

log5js udp
*/

log4js.configure({
  appenders: {
    console: {
      type: 'console'
    },
    /*udpRemote: {
      type: 'udp',
      host: '225.0.0.110',
      port: 1111
    }*/
    udpRemote: {
      type: 'udp'
    }
  },
  categories: {
    default: { appenders: ['console', 'udpRemote'], level: 'info' }
  }
});

const logger = log4js.getLogger('myLogger');
setInterval(()=>{
  logger.info('Test log message %s', 'arg1', 'arg2');
},1000);
