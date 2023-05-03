# 崩坏：星穹铁道跃迁记录导出工具

一个使用 Electron 制作的小工具，需要在 Windows 64位操作系统上运行。

通过读取游戏日志获取访问游戏跃迁记录 API 所需的 authKey，然后再使用获取到的 authKey 来读取游戏祈愿记录。

工具会在当前目录下的 `userData` 文件夹里保存数据，获取到新的祈愿记录时，会与本地数据合并后保存。

## 其它语言

修改 `src/i18n/`目录下的 json 文件就可以翻译到对应的语言。如果觉得已有的翻译有不准确或可以改进的地方，可以随时修改发 Pull Request。

## 使用说明

1. 下载工具后解压
2. 打开游戏的跃迁历史记录（跃迁-查看详情-历史记录）
3. 点击工具的“更新数据”按钮
4. 如果需要导出多个账号的数据，可以切换UID列表至添加新账号项并重复上述操作

## Development

```
# 安装模块
yarn install

# 开发模式
yarn dev

# 构建一个可以运行的程序
yarn build
```

## 参考项目

[Genshin Wish Export](https://github.com/biuuu/genshin-wish-export)

## License

[MIT](https://github.com/biuuu/genshin-wish-export/blob/main/LICENSE)
