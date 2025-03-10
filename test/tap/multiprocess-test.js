const childProcess = require("child_process");
const { test } = require("tap");
const flatted = require("flatted");
const sandbox = require("@log4js-node/sandboxed-module");
const recording = require("../../lib/appenders/recording");

function makeFakeNet() {
  return {
    data: [],
    cbs: {},
    createConnectionCalled: 0,
    createConnection(port, host) {
      const fakeNet = this;
      this.port = port;
      this.host = host;
      this.createConnectionCalled += 1;
      return {
        on(evt, cb) {
          fakeNet.cbs[evt] = cb;
        },
        write(data, encoding) {
          fakeNet.data.push(data);
          fakeNet.encoding = encoding;
        },
        end() {
          fakeNet.closeCalled = true;
        }
      };
    },
    createServer(cb) {
      const fakeNet = this;
      cb({
        remoteAddress: "1.2.3.4",
        remotePort: "1234",
        setEncoding(encoding) {
          fakeNet.encoding = encoding;
        },
        on(event, cb2) {
          fakeNet.cbs[event] = cb2;
        }
      });

      return {
        listen(port, host) {
          fakeNet.port = port;
          fakeNet.host = host;
        }
      };
    }
  };
}

test("Multiprocess Appender", async batch => {
  batch.beforeEach(() => {
    recording.erase();
  });

  batch.test("worker", t => {
    const fakeNet = makeFakeNet();

    const log4js = sandbox.require("../../lib/log4js", {
      requires: {
        net: fakeNet
      }
    });
    log4js.configure({
      appenders: {
        worker: {
          type: "multiprocess",
          mode: "worker",
          loggerPort: 1234,
          loggerHost: "pants"
        }
      },
      categories: { default: { appenders: ["worker"], level: "trace" } }
    });

    const logger = log4js.getLogger();
    logger.info("before connect");
    fakeNet.cbs.connect();
    logger.info("after connect");
    fakeNet.cbs.close();
    logger.info("after error, before connect");
    fakeNet.cbs.connect();
    logger.info("after error, after connect");
    logger.error(new Error("Error test"));

    const net = fakeNet;
    t.test("should open a socket to the loggerPort and loggerHost", assert => {
      assert.equal(net.port, 1234);
      assert.equal(net.host, "pants");
      assert.end();
    });

    t.test(
      "should buffer messages written before socket is connected",
      assert => {
        assert.match(net.data[0], "before connect");
        assert.end();
      }
    );

    t.test(
      "should write log messages to socket as flatted strings with a terminator string",
      assert => {
        assert.match(net.data[0], "before connect");
        assert.equal(net.data[1], "__LOG4JS__");
        assert.match(net.data[2], "after connect");
        assert.equal(net.data[3], "__LOG4JS__");
        assert.equal(net.encoding, "utf8");
        assert.end();
      }
    );

    t.test("should attempt to re-open the socket on error", assert => {
      assert.match(net.data[4], "after error, before connect");
      assert.equal(net.data[5], "__LOG4JS__");
      assert.match(net.data[6], "after error, after connect");
      assert.equal(net.data[7], "__LOG4JS__");
      assert.equal(net.createConnectionCalled, 2);
      assert.end();
    });

    t.test("should serialize an Error correctly", assert => {
      assert.ok(
        flatted.parse(net.data[8]).data[0].stack,
        `Expected:\n\n${net.data[8]}\n\n to have a 'data[0].stack' property`
      );
      const actual = flatted.parse(net.data[8]).data[0].stack;
      assert.match(actual, /^Error: Error test/);
      assert.end();
    });

    t.end();
  });

  batch.test("worker with timeout", t => {
    const fakeNet = makeFakeNet();

    const log4js = sandbox.require("../../lib/log4js", {
      requires: {
        net: fakeNet
      }
    });
    log4js.configure({
      appenders: { worker: { type: "multiprocess", mode: "worker" } },
      categories: { default: { appenders: ["worker"], level: "trace" } }
    });

    const logger = log4js.getLogger();
    logger.info("before connect");
    fakeNet.cbs.connect();
    logger.info("after connect");
    fakeNet.cbs.timeout();
    logger.info("after timeout, before close");
    fakeNet.cbs.close();
    logger.info("after close, before connect");
    fakeNet.cbs.connect();
    logger.info("after close, after connect");

    const net = fakeNet;

    t.test("should attempt to re-open the socket", assert => {
      // skipping the __LOG4JS__ separators
      assert.match(net.data[0], "before connect");
      assert.match(net.data[2], "after connect");
      assert.match(net.data[4], "after timeout, before close");
      assert.match(net.data[6], "after close, before connect");
      assert.match(net.data[8], "after close, after connect");
      assert.equal(net.createConnectionCalled, 2);
      assert.end();
    });
    t.end();
  });

  batch.test("worker with error", t => {
    const fakeNet = makeFakeNet();

    const log4js = sandbox.require("../../lib/log4js", {
      requires: {
        net: fakeNet
      }
    });
    log4js.configure({
      appenders: { worker: { type: "multiprocess", mode: "worker" } },
      categories: { default: { appenders: ["worker"], level: "trace" } }
    });

    const logger = log4js.getLogger();
    logger.info("before connect");
    fakeNet.cbs.connect();
    logger.info("after connect");
    fakeNet.cbs.error();
    logger.info("after error, before close");
    fakeNet.cbs.close();
    logger.info("after close, before connect");
    fakeNet.cbs.connect();
    logger.info("after close, after connect");

    const net = fakeNet;

    t.test("should attempt to re-open the socket", assert => {
      // skipping the __LOG4JS__ separators
      assert.match(net.data[0], "before connect");
      assert.match(net.data[2], "after connect");
      assert.match(net.data[4], "after error, before close");
      assert.match(net.data[6], "after close, before connect");
      assert.match(net.data[8], "after close, after connect");
      assert.equal(net.createConnectionCalled, 2);
      assert.end();
    });
    t.end();
  });

  batch.test("worker defaults", t => {
    const fakeNet = makeFakeNet();

    const log4js = sandbox.require("../../lib/log4js", {
      requires: {
        net: fakeNet
      }
    });
    log4js.configure({
      appenders: { worker: { type: "multiprocess", mode: "worker" } },
      categories: { default: { appenders: ["worker"], level: "trace" } }
    });

    t.test("should open a socket to localhost:5000", assert => {
      assert.equal(fakeNet.port, 5000);
      assert.equal(fakeNet.host, "localhost");
      assert.end();
    });
    t.end();
  });

  batch.test("master", t => {
    const fakeNet = makeFakeNet();

    const log4js = sandbox.require("../../lib/log4js", {
      requires: {
        net: fakeNet,
        "./appenders/recording": recording
      }
    });
    log4js.configure({
      appenders: {
        recorder: { type: "recording" },
        master: {
          type: "multiprocess",
          mode: "master",
          loggerPort: 1234,
          loggerHost: "server",
          appender: "recorder"
        }
      },
      categories: { default: { appenders: ["master"], level: "trace" } }
    });

    const net = fakeNet;

    t.test(
      "should listen for log messages on loggerPort and loggerHost",
      assert => {
        assert.equal(net.port, 1234);
        assert.equal(net.host, "server");
        assert.end();
      }
    );

    t.test("should return the underlying appender", assert => {
      log4js
        .getLogger()
        .info("this should be sent to the actual appender directly");

      assert.equal(
        recording.replay()[0].data[0],
        "this should be sent to the actual appender directly"
      );
      assert.end();
    });

    t.test('should log the error on "error" event', assert => {
      net.cbs.error(new Error("Expected error"));
      const logEvents = recording.replay();
      assert.plan(2);
      assert.equal(logEvents.length, 1);
      assert.equal(
        "A worker log process hung up unexpectedly",
        logEvents[0].data[0]
      );
    });

    t.test("when a client connects", assert => {
      const logString = `${flatted.stringify({
        level: { level: 10000, levelStr: "DEBUG" },
        data: ["some debug"]
      })}__LOG4JS__`;

      net.cbs.data(
        `${flatted.stringify({
          level: { level: 40000, levelStr: "ERROR" },
          data: ["an error message"]
        })}__LOG4JS__`
      );
      net.cbs.data(logString.substring(0, 10));
      net.cbs.data(logString.substring(10));
      net.cbs.data(logString + logString + logString);
      net.cbs.end(
        `${flatted.stringify({
          level: { level: 50000, levelStr: "FATAL" },
          data: ["that's all folks"]
        })}__LOG4JS__`
      );
      net.cbs.data("bad message__LOG4JS__");

      const logEvents = recording.replay();
      // should parse log messages into log events and send to appender
      assert.equal(logEvents[0].level.toString(), "ERROR");
      assert.equal(logEvents[0].data[0], "an error message");
      assert.equal(logEvents[0].remoteAddress, "1.2.3.4");
      assert.equal(logEvents[0].remotePort, "1234");

      // should parse log messages split into multiple chunks'
      assert.equal(logEvents[1].level.toString(), "DEBUG");
      assert.equal(logEvents[1].data[0], "some debug");
      assert.equal(logEvents[1].remoteAddress, "1.2.3.4");
      assert.equal(logEvents[1].remotePort, "1234");

      // should parse multiple log messages in a single chunk'
      assert.equal(logEvents[2].data[0], "some debug");
      assert.equal(logEvents[3].data[0], "some debug");
      assert.equal(logEvents[4].data[0], "some debug");

      // should handle log messages sent as part of end event'
      assert.equal(logEvents[5].data[0], "that's all folks");

      // should handle unparseable log messages
      assert.equal(logEvents[6].level.toString(), "ERROR");
      assert.equal(logEvents[6].categoryName, "log4js");
      assert.equal(logEvents[6].data[0], "Unable to parse log:");
      assert.equal(logEvents[6].data[1], "bad message");

      assert.end();
    });
    t.end();
  });

  batch.test("master without actual appender throws error", t => {
    const fakeNet = makeFakeNet();

    const log4js = sandbox.require("../../lib/log4js", {
      requires: {
        net: fakeNet
      }
    });
    t.throws(
      () =>
        log4js.configure({
          appenders: { master: { type: "multiprocess", mode: "master" } },
          categories: { default: { appenders: ["master"], level: "trace" } }
        }),
      new Error('multiprocess master must have an "appender" defined')
    );
    t.end();
  });

  batch.test("master with unknown appender throws error", t => {
    const fakeNet = makeFakeNet();

    const log4js = sandbox.require("../../lib/log4js", {
      requires: {
        net: fakeNet
      }
    });
    t.throws(
      () =>
        log4js.configure({
          appenders: {
            master: { type: "multiprocess", mode: "master", appender: "cheese" }
          },
          categories: { default: { appenders: ["master"], level: "trace" } }
        }),
      new Error('multiprocess master appender "cheese" not defined')
    );
    t.end();
  });

  batch.test("master defaults", t => {
    const fakeNet = makeFakeNet();

    const log4js = sandbox.require("../../lib/log4js", {
      requires: {
        net: fakeNet
      }
    });
    log4js.configure({
      appenders: {
        stdout: { type: "stdout" },
        master: { type: "multiprocess", mode: "master", appender: "stdout" }
      },
      categories: { default: { appenders: ["master"], level: "trace" } }
    });

    t.test("should listen for log messages on localhost:5000", assert => {
      assert.equal(fakeNet.port, 5000);
      assert.equal(fakeNet.host, "localhost");
      assert.end();
    });
    t.end();
  });

  await batch.test('e2e test', async (assert) => {
    const log4js = sandbox.require('../../lib/log4js', {
      requires: {
        './appenders/recording': recording,
      },
    });
    log4js.configure({
      appenders: {
        recording: { type: 'recording' },
        master: { type: 'multiprocess', mode: 'master', appender: 'recording', loggerPort: 5001 },
      },
      categories: { default: { appenders: ['recording'], level: 'trace' } },
    });
    const child = childProcess.fork(
      require.resolve('../multiprocess-worker.js'),
      ['start-multiprocess-worker', '5001'],
      { stdio: 'inherit' }
    );
    const actualMsg = await new Promise((res, rej) => {
      child.on('message', res);
      child.on('error', rej);
    });

    const logEvents = recording.replay();
    assert.equal(actualMsg, 'worker is done');
    assert.equal(logEvents.length, 1);
    assert.equal(logEvents[0].data[0], 'Logging from worker');
    assert.end();
  });


  batch.end();
});
