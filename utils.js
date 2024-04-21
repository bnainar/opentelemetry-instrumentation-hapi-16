const { SemanticAttributes } = require('@opentelemetry/semantic-conventions');
const {
  HapiLayerType,
  HapiLifecycleMethodNames,
} = require('./internal-types');

const AttributeNames = {
  HAPI_TYPE: "hapi.type",
  PLUGIN_NAME: "hapi.plugin.name",
  EXT_TYPE: "server.ext.type",
};

function getPluginName(plugin) {
  const x = plugin.register?.attributes?.name
  console.log("getPluginName", plugin.register)
  if(!x){
    // process.exit(1)

  }
  console.log(x)
  // if ((plugin).name) {
  //   return (plugin).name;
  // } else {
  //   return (plugin).attributes.name;
  // }
}

const isLifecycleExtType = (
  variableToCheck
) => {
  return (
    typeof variableToCheck === 'string' &&
    HapiLifecycleMethodNames.has(variableToCheck)
  );
};

const isLifecycleExtEventObj = (
  variableToCheck
)=> {
  const event = (variableToCheck)?.type;
  return event !== undefined && isLifecycleExtType(event);
};

const isDirectExtInput = (
  variableToCheck
)=> {
  return (
    Array.isArray(variableToCheck) &&
    variableToCheck.length <= 3 &&
    isLifecycleExtType(variableToCheck[0]) &&
    typeof variableToCheck[1] === 'function'
  );
};

const isPatchableExtMethod = (
  variableToCheck
) => {
  return !Array.isArray(variableToCheck);
};

const getRouteMetadata = (
  route,
  pluginName
) => {
  if (pluginName) {
    return {
      attributes: {
        [SemanticAttributes.HTTP_ROUTE]: route.path,
        [SemanticAttributes.HTTP_METHOD]: route.method,
        [AttributeNames.HAPI_TYPE]: HapiLayerType.PLUGIN,
        [AttributeNames.PLUGIN_NAME]: pluginName,
      },
      name: `${pluginName}: route - ${route.path}`,
    };
  }
  return {
    attributes: {
      [SemanticAttributes.HTTP_ROUTE]: route.path,
      [SemanticAttributes.HTTP_METHOD]: route.method,
      [AttributeNames.HAPI_TYPE]: HapiLayerType.ROUTER,
    },
    name: `route - ${route.path}`,
  };
};

const getExtMetadata = (
  extPoint,
  pluginName
) => {
  if (pluginName) {
    return {
      attributes: {
        [AttributeNames.EXT_TYPE]: extPoint,
        [AttributeNames.HAPI_TYPE]: HapiLayerType.EXT,
        [AttributeNames.PLUGIN_NAME]: pluginName,
      },
      name: `${pluginName}: ext - ${extPoint}`,
    };
  }
  return {
    attributes: {
      [AttributeNames.EXT_TYPE]: extPoint,
      [AttributeNames.HAPI_TYPE]: HapiLayerType.EXT,
    },
    name: `ext - ${extPoint}`,
  };
};

module.exports = {
    getPluginName,
    isLifecycleExtEventObj,
    isLifecycleExtEventObj,
    isDirectExtInput,
    isPatchableExtMethod,
    getRouteMetadata,
    getExtMetadata
}