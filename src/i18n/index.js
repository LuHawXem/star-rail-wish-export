import zhCN from "./简体中文.json" assert { type: "json" };
import zhTW from "./繁体中文.json" assert { type: "json" };

const i18nMap = new Map([
  
])
const data = {
  "zh-cn": zhCN,
  "zh-tw": zhTW,
};

let i18n = null;
export function getLanguageData(lang = "zh-cn") {
  if (!i18n) {
    i18n = data[lang];
  }
  return i18n;
}
