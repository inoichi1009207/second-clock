# 「第二时钟」竞品调研

调研日期：2026-08-09

## 一、先给结论

**更接近“家庭药箱/药品效期管理中的一个未被充分服务的新功能组合”，不是一个从未有人做过的独立品类。**

“包装有效期管理、拍照/OCR 录入、开封后倒计时、专业 BUD 计算”分别已有产品；其中 `Pharma Stock` 已把“开封后保质期”放进消费级家庭药品库存应用，`EyeDrop` 已明确记录眼药水开封日并提醒失效，`Med Expiration` 也提供护士使用的药品及胰岛素效期计算器。因此，“开封后重新起算”本身不能宣称首创。

目前没有找到公开证据显示已有产品同时做到：**面向中国家庭常见药/医疗用品的大规模内置开封效期库、两个不同厂商视觉模型独立识别并在分歧时整条拒填、同名多剂型按效期差异强制用户指认**。可守的差异化是这套“数据覆盖 + fail-closed（拿不准就不填）”组合，而不是日期加法。

### 证据口径

- 只根据本次实际检索到的官网、帮助页、Apple App Store、Google Play 及公开搜索结果记录功能；没有把训练记忆当证据。
- “未找到”只表示**在引用的公开页面及本次中英文检索中未找到**，不等于证明该功能绝对不存在。应用内未公开、区域下架或改名都可能造成漏检。
- `1832 条/23 条剂型规则`是作品公开主张，本次是竞品调研，不是数据或代码审计，未独立验算条目数与正确率。
- 专业药房所说的 BUD 常指**调配制剂从配制日起算**；它与消费级“原厂药拆封后的 in-use shelf life”相邻但不完全相同，表中单独标注，避免混为一谈。

## 二、竞品清单

| 产品名 | 平台 | 主打功能 | **是否处理开封后效期** | 是否有拍照识别 | 是否有交叉验证 | 来源 |
|---|---|---|---|---|---|---|
| 第二时钟（基准） | 单网页/PWA 式体验 | 家庭药箱、开封效期、提醒、离线药库 | **是**；自称 1832 条中文药品/用品及 23 条剂型兜底 | **是**；药盒/喷码照片 | **是**；阿里云百炼与智谱 AI，药名不一致不代填 | [作品页](https://2c.klinik.ren) |
| 用药助手（丁香园） | Web / App | 药品说明书、适应证、禁忌、指南、临床决策 | **未找到**；公开功能页是临床查药，不是家庭库存或开封倒计时 | 未找到药盒效期拍照录入 | 未找到 | [丁香园官方页](https://drugs.dxy.cn/pc) |
| Medisafe | iOS / Android | 服药提醒、服药记录、家人协作、补药提醒、相互作用 | **未找到**；商店功能清单只见剂量/补药管理 | 未找到药盒/效期识别 | 未找到 | [App Store](https://apps.apple.com/us/app/medisafe-medication-management/id573916946)、[官网](https://www.medisafe.com/) |
| MyTherapy | iOS / Android | 服药提醒、摄入记录、库存/补药、症状与测量、医生报告 | **未找到**；官网的 supply 功能是防止药吃完，不是开封后失效 | 未找到 | 未找到 | [官网](https://www.mytherapyapp.com/)、[中国区 App Store](https://apps.apple.com/cn/app/id662170995) |
| Pill Reminder - All in One | iOS | 周期服药提醒、剩余数量、补药提醒 | **未找到**；商店描述未列有效期或开封日 | 未找到 | 未找到 | [App Store](https://apps.apple.com/cn/app/pill-reminder-all-in-one/id816347839) |
| Apple 健康·用药 | iPhone / iPad / Apple Watch | 添加药物、剂量日程、服用/跳过记录、提醒、美国区相互作用 | **未找到**；可设置疗程起止日，但官方页未列药品开封后弃用期 | **有，但范围不同**；美国区可用相机添加药物，不是读取包装效期 | 未找到 | [Apple 官方帮助](https://support.apple.com/en-us/105064) |
| “药盒子” | 未核验 | 用户点名的产品名称 | **未找到可核验结论** | 未找到 | 未找到 | [搜狗精确名称检索](https://www.sogou.com/web?ie=utf8&query=%22%E8%8D%AF%E7%9B%92%E5%AD%90%22%20app)；本次未找到与该精确名称对应的当前官网或商店页，不能把“智能药盒/魔法小药盒”等近名产品硬算作它 |
| 智药箱－智能扫码与家庭药箱管理 | iOS（中国区） | 家庭药箱、拍照录入、包装保质期提醒、本地备份 | **未见**；页面只称“药品保质期/效期” | **是**；“拍照即录入” | 未找到 | [App Store](https://apps.apple.com/cn/app/id6762957163) |
| i药管家 | iOS（中国区） | 服药提醒、家庭共享药箱、条码查药、库存与过期提醒 | **未见**；公开页是药品过期提醒 | 条码识别；未找到照片识别 | 未找到 | [App Store](https://apps.apple.com/cn/app/id6451383362) |
| 家庭药盒管家 | iOS（中国区） | OCR 录入药名/规格/说明、库存、包装有效期提醒，本地保存 | **未见**；页面描述的是“有效期管理” | **是**；药盒照片 OCR | 未找到 | [App Store](https://apps.apple.com/cn/app/id6758618559) |
| 微信家庭药箱类小程序（同类集合） | 微信小程序 | 记录常备药名称和有效期、临期提醒 | **未找到稳定产品明确处理开封后效期**；检索结果主要是手填包装保质期 | 未找到可核验结论 | 未找到 | [搜狗微信检索：家庭药箱+过期提醒](https://weixin.sogou.com/weixin?type=2&query=%E5%AE%B6%E5%BA%AD%E8%8D%AF%E7%AE%B1%20%E5%B0%8F%E7%A8%8B%E5%BA%8F%20%E8%BF%87%E6%9C%9F%E6%8F%90%E9%86%92) |
| MyAidKit | iOS / iPadOS | 家庭药柜、按症状查找、共享药箱、库存与包装有效期提醒 | **未见**；官网描述读取/记录药盒上的 expiry date | **是**；扫描包装并自动填药名 | 未找到 | [官网](https://www.myaidkit.app/) |
| Pharma Stock | iOS / Android | 个人药品库存、数量/效期/使用日志、家庭共享 | **是，但期限由用户自定义**；官网明确写 “Shelf Life After Opening”，可按天/周/月设置 | **是**；相机识别药名、包装有效期、类型、批号、条码 | 未找到 | [官网](https://pharmastock-app.com/) |
| Expiro | Android | 手工录入药名、剂量、包装到期日并提醒 | **未见**；公开页是 manufacturer/entered expiry date | 未找到；页面称手工输入 | 未找到 | [Google Play](https://play.google.com/store/apps/details?id=com.cryptinn.expiredMedicineTracker&hl=en-US) |
| Pill Scan - Medicine Tracker | Android | 家庭药柜、DataMatrix 扫码、药品数据库自动填充、包装效期预警 | **未见**；公开页仅写 expiration tracking | 条码/DataMatrix；未写照片 OCR | 未找到 | [Google Play](https://play.google.com/store/apps/details?id=com.medcab.medcab_app&hl=en-US) |
| ExpirAlert: Med Cabinet | iOS | 家庭药柜、离线 OCR 读取包装到期日、分级提醒 | **未见**；明确读取 medicine box 上的 expiration date | **是**；端侧 OCR | 未找到 | [App Store](https://apps.apple.com/us/app/expiralert-med-cabinet/id6771281085) |
| Eye Drop Reminder - EyeDrop | iOS | 眼药水用药日程、打卡、统计 | **是**；公开页明确“记录眼药水开封时间，在失效前通知” | 未找到 | 未找到 | [App Store](https://apps.apple.com/us/app/eye-drop-reminder-eyedrop/id6757758987) |
| Medication Storage Calculator（Regimen） | Web | 对 Ozempic、Wegovy、Mounjaro、睾酮、HCG、肽类等输入开封日，给出 discard date | **是，窄药种** | 无 | 未找到 | [工具页](https://helloregimen.com/tools/medication-storage-calculator)、[检索结果](https://html.duckduckgo.com/html/?q=medication%20storage%20calculator%20opened%20discard%20date) |
| Med Expiration | iOS / Web，护士/临床工作场景 | 药品效期计算器、药品数据库、召回提醒；付费含胰岛素效期计算器 | **部分**；胰岛素 in-use 语境高度相关，但官网没有把所有计算器输入字段明确写成“开封日” | 未找到 | 未找到 | [官网](https://medexpiration.com/) |
| BUD - Beyond Use Date Calculator | Web，药房调配 | 按 USP 类别/储存条件或自定义天数计算调配制剂 BUD | **邻近但非同类**；从配制日计算，不是识别家庭药盒开封期 | 无 | 无 | [工具页](https://bud.etreacy.me/) |
| EZ Virtual Tools BUD Calculator | Web，药房调配 | 按 USP 795/797、制剂类型、含水与储存条件计算 BUD | **邻近但非同类**；要求用户先选制剂类别与储存条件 | 无 | 无 | [工具页](https://pharmacy.ezvirtualtools.com/calc/beyond-use-dating.html) |
| MedExpiry | PWA，药房/医院/经销商 | 批次库存、包装有效期、临期退货/处置、离线能力 | **未见**；是批次 manufacturer expiry 管理 | 未找到 | 未找到 | [官网](https://www.medexpiry.com/) |
| Aysa（消费级健康视觉 AI 对照） | iOS / Android | 拍皮肤照片，机器学习模型给症状匹配，模糊照片可拒绝分析 | 不适用 | **是** | **未找到**；Google Play 公开表述为一个 machine-learning model，不是两厂商共识 | [Google Play](https://play.google.com/store/apps/details?id=com.visualdx.aysa&hl=en-US)、[官网](https://askaysa.com/) |
| SkinVision（消费级健康视觉 AI 对照） | iOS / Android | 拍皮损照片，AI 算法给皮肤癌风险提示 | 不适用 | **是** | **未找到**；官方公开表述是 “the algorithm”，未见双厂商分歧拒答 | [官网](https://www.skinvision.com/)、[算法说明](https://skinvision.zendesk.com/hc/en-gb/articles/4410223770386-How-SkinVision-works-and-detects-skin-cancer) |

## 三、三个差异点逐项裁定

### 1. 内置“开封后有效期”结构化数据库

**裁定：部分存在。**

证伪到的部分：

- `Pharma Stock` 已在消费级药品库存产品里提供 **Shelf Life After Opening**；这直接否定了“消费级产品没人管开封后效期”。但其公开页写的是用户自定义天/周/月，未见内置药品级规则库。
- `EyeDrop` 已有“记录开封日→失效前提醒”的垂直消费应用。
- `Regimen` 对一组注射类药物提供“开封日→discard date”；`Med Expiration` 还有药品数据库及胰岛素效期计算器。
- 专业端已有多种 BUD 工具，但主要面向 USP 调配制剂，不能等同于中国家庭药盒的 in-use shelf life。

没有证伪到的部分：截至本次检索，**未找到另一款公开声称覆盖约 1832 条中文家庭药品/用品、带 23 条剂型兜底且离线可查的消费产品**。因此，独特性应落在“中文覆盖规模和规则结构”，不能落在“开封后计时”这个概念本身。

### 2. 两个不同厂商视觉模型独立交叉验证，分歧即整条拒填

**裁定：未找到先例。**

本次检索覆盖药盒 OCR/扫码应用、用药提醒头部产品，以及 Aysa、SkinVision 等消费级健康视觉 AI。找到的公开方案是单次 OCR、单模型/单算法、条码数据库，或人工复核；**没有找到公开写明“同一健康照片分别交给两家模型，字段级比较；只要关键结论分歧就一个字段都不预填”的消费产品**。

这不是全球不存在的证明；内部模型编排通常不会公开。机器学习研究中的 ensemble/cross-validation 也不等于这里的产品机制：后者强调不同供应商、运行时独立回答和用户侧 fail-closed。

### 3. 同名多剂型且期限不同时不猜，强制用户照包装选剂型

**裁定：部分存在。**

- 专业 BUD 计算器普遍要求先选“制剂类型、含水与否、储存条件”，说明“关键类别不明就让操作者选择”并不新。
- 眼药水专用产品通过限定剂型回避歧义；普通家庭药箱产品则多让用户自己录入效期或自定义开封期限。
- 但本次**没有找到**另一个公开产品明确实现：同一中文商品/通用名命中多个剂型、发现这些剂型的开封期限不同、因此拒绝自动选中并就地要求用户对照药盒指认。

所以，通用 UX 原则已有；针对“药名—剂型—开封期限”三者联动的具体安全规则仍有差异化。

## 四、品类判断

### 判断：功能叠加为主，具备成为垂直入口的潜力

更接近**“家庭药箱/药品效期追踪产品中的开封后安全层”**，理由如下：

1. 用户已有明确邻近心智：家庭药箱、药品过期提醒、服药提醒、补药提醒。第二时钟仍在完成“录入药→存一个起算日→算日期→提醒”这一既有任务链。
2. 各组件已有直接先例：包装效期追踪与拍照录入（智药箱、MyAidKit、Pharma Stock）、开封后期限（Pharma Stock、EyeDrop、Regimen）、专业 BUD 计算（多款药房工具）。
3. 真正空缺看起来不是“有没有日期计算器”，而是**中国家庭用品的规则数据是否足够广、来源是否可靠，以及识别不确定时是否能安全地什么也不填**。
4. 独立品类通常要形成独立高频需求和用户语言；“beyond-use date app / in-use shelf-life tracker”的消费级搜索结果稀少，用户更多从眼药水、胰岛素或家庭药箱进入。这说明它目前更像强功能/切入口，而非成熟独立品类。

更准确的参赛说法可以是：**不是发明了“提醒”这个品类，而是把长期缺席于家庭药箱软件的“开封后第二期限”做成了可查询、可识别且会拒绝猜测的安全工作流。**

## 五、40 字以内差异化表述

> 拍药盒，双模型不一致不填；1832种开封效期离线算。

（含标点及数字 26 字。）

## 六、反方意见

### 对“这不就是带数据库的日期计算器”最有力的反驳

**日期加法不是产品的难点，给哪盒药套哪条期限才是。** 普通计算器要求用户已经知道药名、剂型和开封后天数；第二时钟试图把三个高风险环节连起来：从包装识别准确药物、按药名与剂型匹配规则、模型或剂型有歧义就拒绝代填。它交付的不是 `开封日 + N 天`，而是“在无法可靠确定 N 时不制造一个看似精确的错误日期”。对家庭用药安全而言，**拒绝猜测**比算术更有产品价值。

### 最难反驳的点

评委的质疑在产品形态上有相当道理：最终输出仍是一个日期和提醒，`Pharma Stock` 已把开封后保质期、药盒扫描、库存和通知放在同一应用里，`EyeDrop` 也已有开封日提醒。**如果不能证明数据库来源、每条规则的可追溯性、同名多剂型覆盖、更新机制及真实识别错误率，1832 这个数量就可能只是“更大的日期表”，而不是壁垒。**

另外，两模型一致不等于正确：两者可能受同一模糊喷码、相似包装或共同训练分布影响而同错。双模型还是一种可复制的工程编排，不是长期护城河。最硬的证据应是：

- 规则来源可追溯，且明确区分说明书值、专业指南值和保守兜底值；
- 一组真实药盒测试中，系统相对单模型少了多少危险误填，而不只是多拒绝了多少；
- 目标用户确实不知道开封期限，并会因为自动提醒改变处置行为；
- 数据维护成本与责任边界可持续。

换言之，**最强卖点是“可信的拒填与可追溯数据”，最弱点是“这些可信度目前若只有产品自述，评委仍会把它看成数据库加日期计算”。**
