import { app, ipcMain, dialog } from "electron";
import * as ExcelJS from "exceljs";
import path from "node:path";
import fs from "fs-extra";
import getConfig from "./config";
import {
  getBaseURL,
  getLanguageMap,
  getWindow,
  isDataUpdateNeeded,
  mergeData,
  readJSON,
  request,
  saveJSON,
  sleep,
} from "./utils";
import { flat } from "../utils/common";
import { gachaType, upGachaType, permanent } from "../utils/constants";
import { getLanguageData } from "../i18n";
import dayjs from "dayjs";

const gachaData = {};
let config = null;

async function saveData(data) {
  const obj = Object.assign({}, data);
  obj.result = Object.assign({}, data.result);
  await saveJSON(`gacha-list-${data.uid}.json`, data);
}

// 获取当前区域设置
async function detectGameLocale(userPath) {
  let list = [];
  const lang = app.getLocale();
  try {
    await fs.access(
      path.join(
        userPath,
        "/AppData/LocalLow/miHoYo/",
        "崩坏：星穹铁道/output_log.txt"
      ),
      fs.constants.F_OK
    );
    list.push("崩坏：星穹铁道");
  } catch (e) {}
  try {
    await fs.access(
      path.join(
        userPath,
        "/AppData/LocalLow/miHoYo/",
        "Star Rail/output_log.txt"
      ),
      fs.constants.F_OK
    );
    list.push("Star Rail");
  } catch (e) {}
  if (lang !== "zh-CN") {
    list.reverse();
  }
  return list;
}

let cacheFolder = null;
// 从日志中获取游戏路径并查找携带有authKey的请求url
async function readGameLogAndFindUrl() {
  try {
    let userPath = null;
    if (!process.env.WINEPREFIX) {
      userPath = app.getPath("home");
    } else {
      userPath = path.join(
        process.env.WINEPREFIX,
        "drive_c/users",
        process.env.USER
      );
    }
    const gameNames = await detectGameLocale(userPath);
    if (!gameNames.length) {
      console.log("error detectGameLocale");
      return null;
    }
    const promises = gameNames.map(async (name) => {
      const logText = await fs.readFile(
        `${userPath}/AppData/LocalLow/miHoYo/${name}/Player.log`,
        "utf8"
      );
      const gamePathMatch = logText.match(/\w:\/.+(StarRail_Data)/);
      if (gamePathMatch) {
        const cacheText = await fs.readFile(
          path.join(gamePathMatch[0], "/webCaches/Cache/Cache_Data/data_2"),
          "utf8"
        );
        const urlMch = cacheText.match(
          /https.+?auth_appid=webview_gacha.+?authkey=.+?game_biz=hkrpg_\w+/g
        );
        if (urlMch) {
          cacheFolder = path.join(gamePathMatch[0], "/webCaches/Cache/");
          return urlMch[urlMch.length - 1];
        }
      }
    });
    const res = await Promise.all(promises);
    for (const url of res) {
      if (url) {
        return url;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

// 拼接url并请求抽卡记录
async function fetchGachaDataList(gacha_type, baseURL) {
  const win = getWindow();
  let page = 1,
    size = 20,
    end_id = 0;
  let list = [];
  win.webContents.send("FETCH_GACHA_DATA", { gacha_type, page });
  try {
    let res;
    while (true) {
      res = await request(
        `${baseURL}&page=${page}&size=${size}&gacha_type=${gacha_type}&default_gacha_type=${gacha_type}&end_id=${end_id}`
      );
      if (res.retcode === -110) {
        continue;
      }
      if (!res.data.list || res.data.list.length <= 0) {
        break;
      }
      list.push(...(res.data.list || []));
      page++;
      end_id = res.data.list[res.data.list.length - 1].id;
      const uid = res.data.list[0].uid;
      // 记录重复时结束请求
      if (
        gachaData[uid] &&
        gachaData[uid].result &&
        gachaData[uid].result[gacha_type] &&
        gachaData[uid].result[gacha_type].findIndex(
          (item) => item.id === end_id
        ) !== -1
      ) {
        break;
      }
      await sleep(200);
    }
  } catch (e) {}
  return list;
}

// 清洗抽卡记录数据, 去除不需要的属性
function filterGachaList(list = []) {
  return list.map(({ count, gacha_id, item_id, lang, uid, ...item }) => item);
}

// 发送一次请求获取当前uid
async function getUid(baseURL) {
  const res = await request(
    `${baseURL}&page=1&size=5&gacha_type=${gachaType[0]}&default_gacha_type=${gachaType[0]}&end_id=0`
  );
  if (res.retcode === 0 && res.data.list && res.data.list.length > 0) {
    return res.data.list[0].uid;
  }
  return "";
}

// 获取抽卡记录数据并返回
async function getGachaData() {
  if (!config) {
    config = await getConfig();
  }
  const result = {};
  let lang = "zh-cn";
  let uid = config.currentUid;
  let baseURL = config.uidMap[uid];
  if (!uid) {
    const originURL = await readGameLogAndFindUrl();
    baseURL = getBaseURL(originURL);
    uid = await getUid(baseURL);
    config.set("currentUid", uid);
    config.uidMap[uid] = baseURL;
    config.save();
  }

  if (uid && gachaData[uid] && !isDataUpdateNeeded(gachaData[uid].time)) {
    return gachaData[uid];
  }

  for (const type of gachaType) {
    const list = await fetchGachaDataList(type, baseURL);
    if (!uid && list.length > 0) {
      uid = list[0].uid;
      lang = list[0].lang;
    }
    result[type] = filterGachaList(list).reverse();
    await sleep(500);
  }

  const data = { result, time: +new Date(), /* typeMap, */ uid, lang };
  const localData = gachaData[uid];
  if (localData) {
    gachaData[uid] = mergeData(localData, data);
  } else {
    gachaData[uid] = data;
  }
  await saveData(gachaData[uid]);
  return gachaData[uid];
}

async function getLocalData() {
  if (!config) {
    config = await getConfig();
  }
  let uid = config.currentUid;
  config.save();
  if (!gachaData[uid]) {
    try {
      const localData = await readJSON(`gacha-list-${uid}.json`);
      gachaData[uid] = localData;
    } catch (e) {}
  }
  return gachaData[uid];
}

// 初始化先触发一次
getLocalData();

async function exportExcel() {
  const workbook = new ExcelJS.Workbook();
  if (!config) {
    config = await getConfig();
  }
  let uid = config.currentUid;
  if (!gachaData[uid]) {
    try {
      const localData = await readJSON(`gacha-list-${uid}.json`);
      gachaData[uid] = localData;
    } catch (e) {}
  }
  const i18n = getLanguageData(config.lang);
  const permanentTemp = flat(permanent);
  for (const type of gachaType) {
    const name = i18n.typeMap[type];
    const sheet = workbook.addWorksheet(name, {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    let width = [14, 8, 8, 8, 8, 24, 8];
    if (config.lang.indexOf("zh-") === -1) {
      width = [32, 16, 12, 12, 12, 24, 12];
    }
    const excelKeys = [
      "name",
      "type",
      "level",
      "total",
      "inside",
      "time",
      "remark",
    ];
    sheet.columns = excelKeys.map((key, index) => {
      return {
        key,
        header: i18n[key],
        width: width[index],
      };
    });
    const gachaList = gachaData[uid].result[type];
    const excelRows = [];
    let total = 0;
    let inside = 0;
    for (let item of gachaList) {
      total += 1;
      inside += 1;
      const row = [
        item.name,
        item.item_type,
        item.rank_type,
        total,
        inside,
        item.time,
      ];
      if (
        item.rank_type === "5" &&
        upGachaType.indexOf(type) !== -1 &&
        permanentTemp.indexOf(item.name) !== -1
      ) {
        row.push(i18n.isPermanent);
      }
        excelRows.push(row);
      if (item.rank_type === "5") {
        inside = 0;
      }
    }
    sheet.addRows(excelRows);
    ["A", "B", "C", "D", "E", "F", "G"].forEach((v) => {
      sheet.getCell(`${v}1`).border = {
        top: { style: "thin", color: { argb: "ffc4c2bf" } },
        left: { style: "thin", color: { argb: "ffc4c2bf" } },
        bottom: { style: "thin", color: { argb: "ffc4c2bf" } },
        right: { style: "thin", color: { argb: "ffc4c2bf" } },
      };
      sheet.getCell(`${v}1`).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "ffdbd7d3" },
      };
      sheet.getCell(`${v}1`).font = {
        name: i18n.fontType,
        color: { argb: "ff757575" },
        bold: true,
      };
    });
    excelRows.forEach((v, i) => {
      ["A", "B", "C", "D", "E", "F", "G"].forEach((c) => {
        sheet.getCell(`${c}${i + 2}`).border = {
          top: { style: "thin", color: { argb: "ffc4c2bf" } },
          left: { style: "thin", color: { argb: "ffc4c2bf" } },
          bottom: { style: "thin", color: { argb: "ffc4c2bf" } },
          right: { style: "thin", color: { argb: "ffc4c2bf" } },
        };
        sheet.getCell(`${c}${i + 2}`).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "ffebebeb" },
        };
        // rare rank background color
        const rankColor = {
          3: "ff8e8e8e",
          4: "ffa256e1",
          5: "ffbd6932",
        };
        sheet.getCell(`${c}${i + 2}`).font = {
          name: i18n.fontType,
          color: { argb: rankColor[v[2]] },
          bold: v[2] != "3",
        };
      });
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  const filePath = dialog.showSaveDialogSync({
    defaultPath: path.join(
      app.getPath("downloads"),
      `${i18n.filePrefix}_${dayjs().format("YYYYMMDD_HHmmss")}`
    ),
    filters: [{ name: i18n.fileType, extensions: ["xlsx"] }],
  });
  if (filePath) {
    await fs.ensureFile(filePath);
    await fs.writeFile(filePath, buffer);
  }
}

// 挂载事件
ipcMain.handle("GET_DATA", getGachaData);
ipcMain.handle("GET_LOCAL_DATA", getLocalData);
ipcMain.handle("CHANGE_CURRENT", async (_, uid) => {
  if (!config) {
    config = await getConfig();
  }
  config.set("currentUid", uid);
  config.save();
});
ipcMain.handle("GET_I18N_DATA", async () => {
  if (!config) {
    config = await getConfig();
  }
  const data = getLanguageData(config.lang);
  return data;
});
ipcMain.handle("GET_LANGUAGE_MAP", getLanguageMap);
ipcMain.handle("GET_CONFIG", () => {
  const { uidMap, ...configTemp } = config;
  return {
    ...configTemp,
    uidList: Object.keys(config.uidMap),
  };
});
ipcMain.handle("CHANGE_LANGUAGE", async (_, lang) => {
  if (!config) {
    config = await getConfig();
  }
  config.set("lang", lang);
  config.save();
});
ipcMain.handle("EXPORT_EXCEL", exportExcel);
