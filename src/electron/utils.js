import { app, BrowserWindow } from "electron";
import windowStateKeeper from "electron-window-state";
import debounce from "loadsh/debounce";
import dayjs from "dayjs";
import crypto from "crypto";
import path from "node:path";
import fs from "fs-extra";
import { gachaType } from "../utils/constants";

const isDev = !app.isPackaged;

const appRoot = isDev
  ? path.resolve(__dirname, "..")
  : path.resolve(app.getAppPath(), "..");

const userDataPath = path.resolve(appRoot, "..", "userData");
const userPath = app.getPath("userData");

let win = null;
export function initWindow() {
  let mainWindowState = windowStateKeeper({
    defaultWidth: 800,
    defaultHeight: 600,
  });
  win = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
  });
  const saveState = debounce(mainWindowState.saveState, 500);
  win.on("resize", () => saveState(win));
  win.on("move", () => saveState(win));
  return win;
}

export function getWindow() {
  return win;
}

export async function request(url) {
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data;
  } catch (e) {
    return {};
  }
}

function fixAuthkey(url) {
  const mr = url.match(/authkey=([^&]+)/);
  if (mr && mr[1] && mr[1].includes("=") && !mr[1].includes("%")) {
    return url.replace(
      /authkey=([^&]+)/,
      `authkey=${encodeURIComponent(mr[1])}`
    );
  }
  return url;
}

export function getBaseURL(url) {
  const { searchParams } = new URL(fixAuthkey(url));

  const authkey = searchParams.get("authkey");
  if (!authkey) {
    console.log("error");
    return false;
  }
  searchParams.delete("page");
  searchParams.delete("size");
  searchParams.delete("gacha_type");
  searchParams.delete("default_gacha_type");
  searchParams.delete("end_id");
  return `${url.split("?")[0]}?${searchParams}`;
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function saveJSON(name, data) {
  try {
    await fs.outputJSON(path.join(userDataPath, name), data, { spaces: 2 });
  } catch (e) {}
}

export async function readJSON(name) {
  let data = {};
  try {
    data = await fs.readJSON(path.join(userDataPath, name));
  } catch (e) {}
  return data;
}

function mergeResult(target = [], origin = []) {
  if (target.length === 0) {
    return [...origin];
  }
  if (origin.length === 0) {
    return [...target];
  }
  const lastId = target[target.length - 1].id;
  const indexOfOrigin = origin.findIndex((item) => item.id === lastId);
  return [...target, ...origin.slice(indexOfOrigin + 1)];
}

export function mergeData(target, origin) {
  if (!target || !target.result) {
    return origin;
  }
  const obj = Object.assign({}, target);
  obj.time = origin.time || +new Date();
  obj.lang = origin.lang || target.lang;
  obj.typeMap = origin.typeMap || target.typeMap;
  obj.result = {};
  for (const type of gachaType) {
    obj.result[type] = mergeResult(target.result[type], origin.result[type]);
  }
  return obj;
}

export function isDataUpdateNeeded(lastTime) {
  const nextTime = +dayjs(lastTime).add(5, "minute").toDate();
  return Date.now() > +nextTime;
}

const languageMap = new Map([
  ["zh-cn", "简体中文"],
  ["zh-tw", "繁體中文"],
  // ["de-de", "Deutsch"],
  // ["en-us", "English"],
  // ["es-es", "Español"],
  // ["fr-fr", "Français"],
  // ["id-id", "Indonesia"],
  // ["ja-jp", "日本語"],
  // ["ko-kr", "한국어"],
  // ["pt-pt", "Português"],
  // ["ru-ru", "Pусский"],
  // ["th-th", "ภาษาไทย"],
  // ["vi-vn", "Tiếng Việt"],
]);

const localeMap = new Map([
  ["zh-cn", ["zh", "zh-CN"]],
  ["zh-tw", ["zh-TW"]],
  // ["de-de", ["de-AT", "de-CH", "de-DE", "de"]],
  // ["en-us", ["en-AU", "en-CA", "en-GB", "en-NZ", "en-US", "en-ZA", "en"]],
  // ["es-es", ["es", "es-419"]],
  // ["fr-fr", ["fr-CA", "fr-CH", "fr-FR", "fr"]],
  // ["id-id", ["id"]],
  // ["ja-jp", ["ja"]],
  // ["ko-kr", ["ko"]],
  // ["pt-pt", ["pt-BR", "pt-PT", "pt"]],
  // ["ru-ru", ["ru"]],
  // ["th-th", ["th"]],
  // ["vi-vn", ["vi"]],
]);

export function getLanguageMap() {
  return languageMap;
}

export function detectAppLocale() {
  const locale = app.getLocale();
  let result = "zh-cn";
  for (let [key, list] of localeMap) {
    if (list.includes(locale)) {
      result = key;
      break;
    }
  }
  return result;
}

const scryptKey = crypto.scryptSync(userPath, "hk4e", 24);
export function cipherAes(data) {
  const algorithm = "aes-192-cbc";
  const iv = Buffer.alloc(16, 0);
  const cipher = crypto.createCipheriv(algorithm, scryptKey, iv);
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

export function decipherAes(encrypted) {
  const algorithm = "aes-192-cbc";
  const iv = Buffer.alloc(16, 0);
  const decipher = crypto.createDecipheriv(algorithm, scryptKey, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
