#!/usr/bin/env node
const argv = process.argv.slice(2);
const host = argv[0] || '225.0.0.110';
const port = argv[1] || 1111;


const dgram = require('dgram');
const log4js = require('./log4js');
log4js.configure({
    appenders: {
        stdout: {
            type: 'console'
        },
    },
    categories: {
        default: {appenders: ['stdout'], level: 'debug'}
    }
});
const logger = log4js.getLogger('default');

const server = dgram.createSocket('udp4');

server.on('close', () => {
    logger.info('socket closed');
});

server.on('error', (err) => {
    logger.info(err);
});

server.on('listening', () => {
    const info = server.address();
    // logger.debug(`server listening ${info.address}:${info.port}`);
    logger.debug(`server listening ${host}:${info.port}`);
    server.addMembership(host);
});

server.on('message', (buffer, info) => {
    let dataStr = buffer.toString(),
        index = dataStr.indexOf(' - '),
        args = dataStr.substring(dataStr.indexOf('] [') + 3, index).split('] '),
        logStr = dataStr.substr(index + 3).replace(/\r\n/ig,'');
    // logger.info(`args:`, args);
    // console.log(`data:`, logStr);
    // logger.info(`receive message from ${info.address}:${info.port}`, buffer.toString());
    const remoteLogger = log4js.getLogger(args[1]);
    remoteLogger.level = args[0].toLowerCase();
    remoteLogger[args[0].toLowerCase()](logStr);
});

server.bind(port);

process.on('exit', () => {
    logger.info('exit');
    server.close();
});















