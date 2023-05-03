import {
  cipherAes,
  decipherAes,
  detectAppLocale,
  readJSON,
  saveJSON,
} from "./utils";

const defaultConfig = {
  uidMap: {},
  currentUid: "",
  lang: detectAppLocale(),
};

let config = null;
async function getConfig() {
  if (!config) {
    let localConfig = await readJSON("config.json");
    if (!localConfig) localConfig = Object.assign({}, defaultConfig);
    const configTemp = {};
    for (const key in localConfig) {
      if (!Object.hasOwnProperty.call(localConfig, key)) {
        return;
      }
      if (typeof defaultConfig[key] !== "undefined") {
        configTemp[key] = localConfig[key];
      }
    }
    for (const key in configTemp.uidMap) {
      if (!Object.hasOwnProperty.call(configTemp.uidMap, key)) {
        return;
      }
      try {
        configTemp.uidMap[key] = decipherAes(configTemp.uidMap[key]);
      } catch (e) {
        configTemp.uidMap[key] = "";
      }
    }
    Object.assign(defaultConfig, configTemp);

    config = new Proxy(defaultConfig, {
      get(obj, p) {
        switch (p) {
          case "save":
            return saveConfig;
          case "set":
            return setConfig;
          default:
            return obj[p];
        }
      },
    });
  }
  return config;
}

getConfig();

function setConfig(key, value) {
  Reflect.set(defaultConfig, key, value);
}

async function saveConfig() {
  const configTemp = Object.assign({}, defaultConfig);
  configTemp.uidMap = Object.assign({}, defaultConfig.uidMap);
  for (const key in configTemp.uidMap) {
    if (!Object.hasOwnProperty.call(configTemp.uidMap, key)) {
      return;
    }
    try {
      configTemp.uidMap[key] = cipherAes(configTemp.uidMap[key]);
    } catch (e) {
      configTemp.uidMap[key] = "";
    }
  }
  await saveJSON("config.json", configTemp);
}

export default getConfig;
