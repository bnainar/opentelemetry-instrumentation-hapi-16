module.exports.HapiComponentName = 'hapi';

/**
 * This symbol is used to mark a Hapi route handler or server extension handler as
 * already patched, since its possible to use these handlers multiple times
 * i.e. when allowing multiple versions of one plugin, or when registering a plugin
 * multiple times on different servers.
 */
module.exports.handlerPatched = Symbol('hapi-handler-patched');

module.exports.HapiLayerType = {
  ROUTER: 'router',
  PLUGIN: 'plugin',
  EXT: 'server.ext',
};

module.exports.HapiLifecycleMethodNames = new Set([
  'onPreAuth',
  'onPostAuth',
  'onPreHandler',
  'onPostHandler',
  'onPreResponse',
  'onRequest',
]);