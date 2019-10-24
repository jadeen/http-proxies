const connect = require('connect');
const Proxy = require('http-proxy-middleware');

const ProxiesWrapperMiddleware = require('./ProxiesWrapperMiddleware');
const store = require('./store');

module.exports = function proxy(middlewares = [], logger) {
  const conf = store.get('proxies');
  const app = connect();

  var wsProxy = Proxy('/live', {
    target: 'wss://app.test.sekoia.io/live/socket.io/',
    ws: true, // enable websocket proxy,
    secure: false,
    logLevel: 'debug',
    rewriteHeaders: {
      Host: 'test.sekoia.io'
    },
    pathRewrite: { '^/live/socket.io/': '/' },
    autoRewrite: true,
    onProxyReqWs(proxyReq, req, res) {
      proxyReq.setHeader('Host', 'test.sekoia.io');

      logger.debug(
        'Proxy request from',
        `${proxyReq.agent.protocol}//${req.headers.host}${req.originalUrl}`
      );
    },
    onOpen(proxySocket) {
      console.log('OPPPPPPPPPPPPPPEN');
    },
    onClose(res) {
      console.log('CLLLLLLLLLLLLLLOSE');
      console.log('Socket close', res);
    },
    onError(err) {
      console.log('ERRRRRRRRRRRRRRRRRRRROR');
      console.log(err);
    }
  });

  app.use(wsProxy);

  middlewares.forEach(middleware => {
    app.use(middleware);
  });

  const wrapper = new ProxiesWrapperMiddleware(store);
  conf.forEach(({ context, uuid, ...rules }) =>
    context.forEach(route => {
      const { rewriteHeaders, ...keep } = rules;
      const proxyConf = { ...keep, ...proxyEventsListener(rules, logger) };
      console.log({ proxyConf, uuid, route });
      wrapper.insert(uuid, route, Proxy(proxyConf));
    })
  );
  app.use(wrapper.middleware());

  return { app, wrapper };
};

function proxyEventsListener(rules, logger) {
  const { rewriteHeaders } = rules;
  const listeners = {
    onProxyReq(proxyReq, req, res) {
      if (rewriteHeaders) {
        writeHeaders(proxyReq, rules.rewriteHeaders, logger);
      }
      logger.debug(
        'Proxy request from',
        `${proxyReq.agent.protocol}//${req.headers.host}${req.originalUrl}`
      );
    },
    onProxyRes(proxyRes, req, res) {
      logger.debug(
        'Proxy response from',
        `${proxyRes.socket.encrypted ? 'https' : 'http'}://${
          proxyRes.connection.remoteAddress
        }:${proxyRes.connection.remotePort}${proxyRes.req.path}`
      );
    }
  };

  return listeners;
}

function writeHeaders(proxyReq, rewriteHeadersConf, logger) {
  Object.entries(rewriteHeadersConf).forEach(([name, value]) => {
    logger.debug('Write header', name, value);
    proxyReq.setHeader(name, value);
  });
}
