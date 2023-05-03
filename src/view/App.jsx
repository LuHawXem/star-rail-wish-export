import { ipcRenderer } from "electron";
import { ref, onBeforeMount, onMounted } from "vue";
import { Button, Drawer, Select, Space, Spin } from "ant-design-vue";
import {
  SyncOutlined,
  ExportOutlined,
  SettingOutlined,
  RedoOutlined,
  CheckCircleFilled,
} from "@ant-design/icons-vue";
import dayjs from "dayjs";
import WrapComponent from "../utils/wrapComponent";
import { gachaType, upGachaType, permanent, rankColor, colors } from "../utils/constants";
import { flat } from "../utils/common";
import styles from "./index.module.css";

const { Option } = Select;

const permanentList = flat(permanent);

function App() {
  const syncLoading = ref(false);
  const dataLoading = ref(false);

  const showDrawer = ref(false);

  const i18n = ref({});

  const config = ref({
    uidList: [],
    currentUid: "",
    lang: "zh-cn",
  });

  const languageMap = ref({});
  const languageChanged = ref(false);

  const gachaList = ref([]);
  const lastTime = ref("");

  onBeforeMount(async () => {
    i18n.value = await ipcRenderer.invoke("GET_I18N_DATA");
    config.value = await ipcRenderer.invoke("GET_CONFIG");
    document.title = i18n.value.winTitle;
    languageMap.value = await ipcRenderer.invoke("GET_LANGUAGE_MAP");
  });

  onMounted(async () => {
    const data = await ipcRenderer.invoke("GET_LOCAL_DATA");
    if (!data) return;
    setData(data);
  });

  const getDataList = (result) => {
    const dataList = [];
    for (const key in result) {
      if (!Object.hasOwnProperty.call(result, key)) {
        continue;
      }
      const list = result[key];
      if (list.length <= 0) {
        dataList.push({
          key,
          gachaType: i18n.value.typeMap[key],
          history: [],
          rank: [],
          total: list.length,
          current: 0,
        });
        continue;
      }
      let count = 0;
      let historyList = [];
      let rankList = [0, 0, 0];
      for (let i = 0; i < list.length; i++) {
        count++;
        const rank = +list[i].rank_type;
        rankList[rank - 3]++;
        if (rank !== 5) {
          continue;
        }
        const item = {
          ...list[i],
          count,
        }
        if (upGachaType.indexOf(key) !== -1 && permanentList.indexOf(list[i].name) !== -1) {
          item.remark = i18n.value.isPermanent;
        }
        historyList.push(item);
        count = 0;
      }
      dataList.push({
        key,
        gachaType: i18n.value.typeMap[key],
        history: historyList,
        rank: rankList.reverse(),
        total: list.length,
        current: count,
        startTime: dayjs(list[0].time).format("YYYY-MM-DD"),
        endTime: dayjs(list[list.length - 1].time).format("YYYY-MM-DD"),
      });
    }
    dataList.sort(
      (a, b) => gachaType.indexOf(a.key) - gachaType.indexOf(b.key)
    );
    return dataList;
  };

  const setData = (data) => {
    gachaList.value = getDataList(data.result);
    lastTime.value = data.time
      ? dayjs(data.time).toDate().toLocaleString()
      : "";
  };

  const changeCurrentUid = async (value) => {
    dataLoading.value = true;
    await ipcRenderer.invoke("CHANGE_CURRENT", value);
    const data = await ipcRenderer.invoke("GET_LOCAL_DATA");
    if (!data) return;
    setData(data);
    dataLoading.value = false;
  };

  const changeLanguage = async (lang) => {
    await ipcRenderer.invoke("CHANGE_LANGUAGE", lang);
    i18n.value = await ipcRenderer.invoke("GET_I18N_DATA");
    config.value.lang = lang;
    if (!languageChanged.value) languageChanged.value = true;
    document.title = i18n.value.winTitle;
  };

  const handleClick = async () => {
    syncLoading.value = true;
    const data = await ipcRenderer.invoke("GET_DATA");
    if (!data) return;
    setData(data);
    syncLoading.value = false;
  };

  return () => (
    <div className={styles.wrap}>
      <div className={styles.operate}>
        <Space>
          <Button
            onClick={() => handleClick()}
            type="primary"
            icon={<SyncOutlined />}
            loading={syncLoading.value}
          >
            {i18n.value.updateData}
          </Button>
          <Button
            onClick={() => {
              ipcRenderer.invoke("EXPORT_EXCEL");
            }}
            icon={<ExportOutlined />}
          >
            {i18n.value.exportExcel}
          </Button>
        </Space>
        <Space>
          <Select
            style={{ width: "120px" }}
            value={
              config.value.currentUid
                ? config.value.currentUid
                : i18n.value.addAccount
            }
            onChange={(value) => changeCurrentUid(value)}
          >
            {config.value.uidList.map((uid) => (
              <Option value={uid}>{uid}</Option>
            ))}
            <Option value="">{i18n.value.addAccount}</Option>
          </Select>
          <Button
            onClick={() => (showDrawer.value = true)}
            icon={<SettingOutlined />}
          >
            {i18n.value.setting}
          </Button>
        </Space>
      </div>
      <div className={styles.tip}>
        {lastTime.value
          ? `${i18n.value.lastUpdate}${i18n.value.symbol}${lastTime.value}`
          : ""}
      </div>
      {!dataLoading.value ? (
        <div className={styles.gacha}>
          {gachaList.value.map((item) => {
            if (item.total === 0) {
              return (
                <div key={item.key} className={styles.item}>
                  <div className={styles.title}>{item.gachaType}</div>
                  <div className={styles.stat}>{i18n.value.noHistory}</div>
                </div>
              );
            }
            return (
              <div key={item.key} className={styles.item}>
                <div className={styles.title}>{item.gachaType}</div>
                <div className={styles.timeline}>
                  {item.startTime}-{item.endTime}
                </div>
                <div className={styles.stat}>
                  {i18n.value.allTogether}
                  <span>{` ${item.total} `}</span>
                  {i18n.value.unit}
                  <br />
                  {i18n.value.grandTotal[0]}
                  <span>{` ${item.current} `}</span>
                  {i18n.value.unit}
                  {i18n.value.grandTotal[1]}
                  {i18n.value.rank["5"]}
                </div>
                <div className={styles.rank}>
                  {item.rank.map((r, index) => {
                    return (
                      <div key={index} style={{ color: rankColor[index] }}>
                        {index === 0
                          ? i18n.value.rank["5"]
                          : index === 1
                          ? i18n.value.rank["4"]
                          : i18n.value.rank["3"]}
                        {i18n.value.symbol}
                        {r}
                        {`[${((r / item.total) * 100).toFixed(2)}%]`}
                      </div>
                    );
                  })}
                </div>
                {item.history && item.history.length > 0 ? (
                  <div className={styles.list}>
                    {i18n.value.rank["5"]}
                    {i18n.value.history}
                    {i18n.value.symbol}
                    {item.history.map((h) => {
                      let code = 0;
                      for (let i = 0; i < h.name.length; i++) {
                        code += h.name.charCodeAt(i);
                      }
                      return (
                        <span
                          key={h.id}
                          style={{ color: colors[code % colors.length] }}
                        >
                          {`[${h.count}]`}
                          {h.name}
                          {h.remark ? `(${h.remark})` : null}
                        </span>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.loading}>
          <Spin></Spin>
        </div>
      )}
      <Drawer
        title={i18n.value.setting}
        visible={showDrawer.value}
        placement="right"
        closable={false}
        onClose={() => (showDrawer.value = false)}
      >
        <Space direction="vertical" size="middle">
          <div>
            <div className={styles.title}>{i18n.value.languageSetting}</div>
            <Space>
              <Select
                style={{ width: "120px" }}
                value={config.value.lang}
                onChange={(lang) => changeLanguage(lang)}
              >
                {Array.from(languageMap.value).map(([value, label]) => (
                  <Option value={value}>{label}</Option>
                ))}
              </Select>
              <Button
                icon={<RedoOutlined />}
                style={{ display: !languageChanged.value ? "none" : "unset" }}
                onClick={() => {
                  ipcRenderer.invoke("RELAUNCH");
                }}
              ></Button>
            </Space>
            {languageChanged.value ? (
              <div className={styles.relaunchTip}>
                <CheckCircleFilled
                  style={{ color: "#52c41a", paddingRight: "5px" }}
                />
                {i18n.value.languageChanged}
              </div>
            ) : null}
          </div>
        </Space>
      </Drawer>
    </div>
  );
}

export default WrapComponent(App);
