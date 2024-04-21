const api = require('@opentelemetry/api');
const { getRPCMetadata, RPCType } = require('@opentelemetry/core');
const {
  InstrumentationBase,
  InstrumentationNodeModuleDefinition,
  isWrapped,
} = require('@opentelemetry/instrumentation');
const {
  HapiComponentName,
  handlerPatched,
  PatchableServerRoute,
  HapiServerRouteInputMethod,
  RegisterFunction,
  PatchableExtMethod,
} = require('./internal-types');
const {
  getRouteMetadata,
  getPluginName,
  isLifecycleExtType,
  isLifecycleExtEventObj,
  getExtMetadata,
  isDirectExtInput,
  isPatchableExtMethod,
} = require( './utils');

/** Hapi instrumentation for OpenTelemetry */
module.exports = class hepi extends InstrumentationBase {
  co = 0;
  constructor(config) {
    console.log("nainar super")
    super('@nainar/instrumentation-hapi', "1", config);
  }

   init() {
    return new InstrumentationNodeModuleDefinition(
      HapiComponentName,
      ['<=21'],
      moduleExports => {
        if (!isWrapped(moduleExports.server)) {
          api.diag.debug('Patching Hapi.server');
          console.log('Patching Hapi.server');
          this._wrap(moduleExports, 'server', this._getServerPatch.bind(this));
        }

        // Casting as any is necessary here due to an issue with the @types/hapi__hapi
        // type definition for Hapi.Server. Hapi.Server (note the uppercase) can also function
        // as a factory function, similarly to Hapi.server (lowercase), and so should
        // also be supported and instrumented. This is an issue with the DefinitelyTyped repo.
        // Function is defined at: https://github.com/hapijs/hapi/blob/main/lib/index.js#L9
        if (!isWrapped(moduleExports.Server)) {
          api.diag.debug('Patching Hapi.Server');
          console.log('Patching Hapi.Server xx');
          this._wrap(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            moduleExports,
            'Server',
            this._getServerPatch.bind(this)
          );
        }
        return moduleExports;
      },
      moduleExports => {
        api.diag.debug('Unpatching Hapi');
        this._massUnwrap([moduleExports], ['server', 'Server']);
      }
    );
  }

  /**
   * Patches the Hapi.server and Hapi.Server functions in order to instrument
   * the server.route, server.ext, and server.register functions via calls to the
   * @function _getServerRoutePatch, @function _getServerExtPatch, and
   * @function _getServerRegisterPatch functions
   * @param original - the original Hapi Server creation function
   */
  _getServerPatch(original) {
    const instrumentation = this;
    const self = this;
    return function server(opts) {
        function WrappedServer(opts) {
          return new original(opts); // Instantiate the original Hapi.Server
        }

        // Create a new server instance using the wrapped constructor
        const newServer = new WrappedServer(opts);
        console.log("wrapping routes")
        self._wrap(newServer, 'route', originalRouter => {
          return instrumentation._getServerRoutePatch.bind(instrumentation)(originalRouter);
        });
        // Casting as any is necessary here due to multiple overloads on the Hapi.ext
        // function, which requires supporting a variety of different parameters
        // as extension inputs
        console.log("wrapping ext")
        self._wrap(newServer, 'ext', originalExtHandler => {
            return instrumentation._getServerExtPatch.bind(instrumentation)(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            originalExtHandler);
        });
        // Casting as any is necessary here due to multiple overloads on the Hapi.Server.register
        // function, which requires supporting a variety of different types of Plugin inputs
        // console.log("wrapping register")

        // self._wrap(
        //     newServer, 
        //     'register', 
        //     instrumentation._getServerRegisterPatch.bind(instrumentation)
        // );
        return newServer;
    };
}

  /**
   * Patches the plugin register function used by the Hapi Server. This function
   * goes through each plugin that is being registered and adds instrumentation
   * via a call to the @function _wrapRegisterHandler function.
   * @param {RegisterFunction<T>} original - the original register function which
   * registers each plugin on the server
   */
   _getServerRegisterPatch(
    original
  ) {
    const instrumentation = this;
    api.diag.debug('Patching Hapi.Server register function');
    console.log('_getServerRegisterPatch');
    return function register(
      pluginInput,
      options
    ) {
      console.log("pluginInput", pluginInput)
      if (Array.isArray(pluginInput)) {
        // for (const pluginObj of pluginInput) {
        //   instrumentation._wrapRegisterHandler(
        //     pluginObj.plugin?.plugin ?? pluginObj.plugin ?? pluginObj
        //   );
        // }
      } else {
        // process.exit(1)
        // console.log("calling instrumentation._wrapRegisterHandler")
        // instrumentation._wrapRegisterHandler(
        //   pluginInput.register
        // );
      }
      return original.apply(this, [pluginInput, options]);
    };
  }

  /**
   * Patches the Server.ext function which adds extension methods to the specified
   * point along the request lifecycle. This function accepts the full range of
   * accepted input into the standard Hapi `server.ext` function. For each extension,
   * it adds instrumentation to the handler via a call to the @function _wrapExtMethods
   * function.
   * @param original - the original ext function which adds the extension method to the server
   * @param {string} [pluginName] - if present, represents the name of the plugin responsible
   * for adding this server extension. Else, signifies that the extension was added directly
   */
   _getServerExtPatch(
    original,
    pluginName
  ) {
    const instrumentation = this;
    api.diag.debug('Patching Hapi.Server ext function');
    console.log("_getServerExtPatch")
    return function ext(
      ...args
    ) {
      if (Array.isArray(args[0])) {
        const eventsList = args[0];
        for (let i = 0; i < eventsList.length; i++) {
          const eventObj = eventsList[i];
          if (isLifecycleExtType(eventObj.type)) {
            const lifecycleEventObj =
              eventObj;
            const handler = instrumentation._wrapExtMethods(
              lifecycleEventObj.method,
              eventObj.type,
              pluginName
            );
            lifecycleEventObj.method = handler;
            eventsList[i] = lifecycleEventObj;
          }
        }
        return original.apply(this, args);
      } else if (isDirectExtInput(args)) {
        const extInput = args;
        const method = extInput[1];
        const handler = instrumentation._wrapExtMethods(
          method,
          extInput[0],
          pluginName
        );
        return original.apply(this, [extInput[0], handler, extInput[2]]);
      } else if (isLifecycleExtEventObj(args[0])) {
        const lifecycleEventObj = args[0];
        const handler = instrumentation._wrapExtMethods(
          lifecycleEventObj.method,
          lifecycleEventObj.type,
          pluginName
        );
        lifecycleEventObj.method = handler;
        return original.call(this, lifecycleEventObj);
      }
      return original.apply(this, args);
    };
  }

  /**
   * Patches the Server.route function. This function accepts either one or an array
   * of Hapi.ServerRoute objects and adds instrumentation on each route via a call to
   * the @function _wrapRouteHandler function.
   * @param {HapiServerRouteInputMethod} original - the original route function which adds
   * the route to the server
   * @param {string} [pluginName] - if present, represents the name of the plugin responsible
   * for adding this server route. Else, signifies that the route was added directly
   */
   _getServerRoutePatch(
    original,
    pluginName
  ) {
    const instrumentation = this;
    api.diag.debug('Patching Hapi.Server route function');
    console.log('_getServerRoutePatch', original, pluginName);
    return function route(
      route
    ) {
      if (Array.isArray(route)) {
        for (let i = 0; i < route.length; i++) {
          const newRoute = instrumentation._wrapRouteHandler.call(
            instrumentation,
            route[i],
            pluginName
          );
          route[i] = newRoute;
        }
      } else {
        route = instrumentation._wrapRouteHandler.call(
          instrumentation,
          route,
          pluginName
        );
      }
      return original.apply(this, [route]);
    };
  }

  /**
   * Wraps newly registered plugins to add instrumentation to the plugin's clone of
   * the original server. Specifically, wraps the server.route and server.ext functions
   * via calls to @function _getServerRoutePatch and @function _getServerExtPatch
   * @param {Hapi.Plugin<T>} plugin - the new plugin which is being instrumented
   */
   _wrapRegisterHandler(plugin) {
    console.log("_wrapRegisterHandler", plugin)
    const instrumentation = this;
    const pluginName = getPluginName(plugin);
    const oldHandler = plugin.register;
    const self = this;
    const newRegisterHandler = function (server, options) {
      server.route;
      console.log("_wrapRegisterHandler > before route patch")
      self._wrap(server, 'route', original => {
        console.log("_wrapRegisterHandler > patch")
        return instrumentation._getServerRoutePatch.bind(instrumentation)(
          original,
          pluginName
        );
      });

      // Casting as any is necessary here due to multiple overloads on the Hapi.ext
      // function, which requires supporting a variety of different parameters
      // as extension inputs
      self._wrap(server, 'ext', originalExtHandler => {
        return instrumentation._getServerExtPatch.bind(instrumentation)(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          originalExtHandler,
          pluginName
        );
      });
      return oldHandler(server, options);
    };
    plugin.register = newRegisterHandler;

  }

  /**
   * Wraps request extension methods to add instrumentation to each new extension handler.
   * Patches each individual extension in order to create the
   * span and propagate context. It does not create spans when there is no parent span.
   * @param {PatchableExtMethod | PatchableExtMethod[]} method - the request extension
   * handler which is being instrumented
   * @param {Hapi.ServerRequestExtType} extPoint - the point in the Hapi request lifecycle
   * which this extension targets
   * @param {string} [pluginName] - if present, represents the name of the plugin responsible
   * for adding this server route. Else, signifies that the route was added directly
   */
   _wrapExtMethods(
    method,
    extPoint,
    pluginName
  ){
    const instrumentation = this;

    if (method instanceof Array) {
      for (let i = 0; i < method.length; i++) {
        method[i] = instrumentation._wrapExtMethods(
          method[i],
          extPoint
        ) ;
      }
      return method;
    } else if (isPatchableExtMethod(method)) {
      if (method[handlerPatched] === true) return method;
      method[handlerPatched] = true;

      const newHandler = async function (
        ...params
      ) {
        if (api.trace.getSpan(api.context.active()) === undefined) {
          return await method.apply(this, params);
        }
        const metadata = getExtMetadata(extPoint, pluginName);
        const span = instrumentation.tracer.startSpan(metadata.name, {
          attributes: metadata.attributes,
        });
        try {
          return await api.context.with(
            api.trace.setSpan(api.context.active(), span),
            method,
            undefined,
            ...params
          );
        } catch (err) {
          span.recordException(err);
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: err.message,
          });
          throw err;
        } finally {
          span.end();
        }
      };
      return newHandler ;
    }
    return method;
  }

  /**
   * Patches each individual route handler method in order to create the
   * span and propagate context. It does not create spans when there is no parent span.
   * @param {PatchableServerRoute} route - the route handler which is being instrumented
   * @param {string} [pluginName] - if present, represents the name of the plugin responsible
   * for adding this server route. Else, signifies that the route was added directly
   */
   _wrapRouteHandler(
    route,
    pluginName
   ) {
    console.log("_wrapRouteHandler", route, pluginName)
    const instrumentation = this;
    if (route[handlerPatched] === true) return route;
    route[handlerPatched] = true;
    const oldHandler = route.config?.handler ?? route.handler;
    
    if (typeof oldHandler === 'function') {
      console.log("legit handler")
      const newHandler = async function (
        ...params
      ) {
        if (api.trace.getSpan(api.context.active()) === undefined) {
          return await oldHandler(...params);
        }
        const rpcMetadata = getRPCMetadata(api.context.active());
        if (rpcMetadata?.type === RPCType.HTTP) {
          rpcMetadata.route = route.path;
        }
        const metadata = getRouteMetadata(route, pluginName);
        const span = instrumentation.tracer.startSpan(metadata.name, {
          attributes: metadata.attributes,
        });
        console.log("span", span)
        try {
          return await api.context.with(
            api.trace.setSpan(api.context.active(), span),
            () => oldHandler(...params)
          );
        } catch (err) {
          span.recordException(err);
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: err.message,
          });
          throw err;
        } finally {
          span.end();
        }
      };
      if (route.config?.handler) {
        route.config.handler = newHandler;
      } else {
        route.handler = newHandler;
      }
    }
    return route;
  }
}