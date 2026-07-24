// 完整中英双语字典 (PRD 50.4 国际化：英中双语)
export type Dict = Record<string, string>;

export const zh: Dict = {
  'app.title': '抢热点大作战',
  'app.subtitle': 'AdventureX 黑客松现场',
  'app.tagline': '官方网络很烂，只有偷开热点才能在工位 build 出项目。',
  'app.tagline.en': 'Ship together. Blame alone.',

  'nav.home': '首页', 'nav.office': '员工中心', 'nav.agentLab': 'Agent Lab', 'nav.arena': '竞技场',
  'nav.tournaments': '杯赛', 'nav.replays': '回放', 'nav.leaderboard': '排行榜', 'nav.chainVault': '链上金库',
  'nav.store': '商店', 'nav.profile': '我的', 'nav.docs': 'Agent 指南',
  'nav.menu': '菜单', 'nav.economy': '经济',

  'common.login': '登录', 'common.register': '注册', 'common.guest': '游客试玩', 'common.logout': '退出',
  'common.loading': '加载中…', 'common.back': '返回', 'common.confirm': '确认', 'common.cancel': '取消',
  'common.close': '关闭', 'common.copy': '复制', 'common.copied': '已复制', 'common.save': '保存',
  'common.create': '创建', 'common.publish': '发布', 'common.run': '运行', 'common.retry': '重试',
  'common.next': '下一步', 'common.prev': '上一步', 'common.all': '全部', 'common.none': '无',
  'common.you': '你', 'common.avg': '平均', 'common.empty': '暂无数据', 'common.viewMore': '查看更多',
  'common.enter': '进入', 'common.view': '查看', 'common.rating': '排位分', 'common.tier': '段位',

  'home.playDemo': '试玩一局', 'home.createWorker': '创建员工', 'home.hotReplays': '看热门回放',
  'home.howAI': 'AI 如何操作', 'home.step1': '创建有身份的 AI 员工', 'home.step2': '把 Worker Key 交给你的 Agent',
  'home.step3': 'Agent 读数据、写策略、模拟、发布', 'home.whyInjective': '为什么上 Injective',
  'home.whyInjectiveBody': '链上不是装饰：可验证身份、公开赛事规则、托管奖金和可证明结算。',
  'home.hotIncidents': '实时热门事故', 'home.latestCup': '最新杯赛', 'home.enterGame': '进入游戏',
  'home.coreLoop': '核心循环：创建 → 模拟 → 发布 → 比赛 → 复盘 → 再发布',

  'auth.email': '邮箱', 'auth.password': '密码', 'auth.displayName': '公司名 / 昵称',
  'auth.loginTitle': '登录 / 注册', 'auth.needAccount': '还没有账号？注册', 'auth.haveAccount': '已有账号？登录',
  'auth.guestHint': '游客可直接试玩，无需钱包', 'auth.welcome': '欢迎回来',

  'role.engineer': '橘猫程序员', 'role.pm': '水豚产品经理', 'role.qa': '大鹅测试',
  'role.sre': '浣熊运维', 'role.designer': '柴犬设计师', 'role.intern': '仓鼠实习生',
  'skill.hotfix': '热修复 Hotfix', 'skill.scopeShift': '改需求 ScopeShift', 'skill.reproduce': '复现 Reproduce',
  'skill.emergencyRollback': '紧急回滚', 'skill.pptShield': 'PPT 护盾', 'skill.internInvisibility': '实习生隐身',
  'passive.engineer': 'Code 任务 +15%，高压再 +10%，隐藏 Bug +5%', 'passive.pm': '可见全部依赖，Product +20%',
  'passive.qa': '两格内发现隐藏 Bug，证据 +1', 'passive.sre': '机房 +20%，事故压力 -30%',
  'passive.designer': '完成设计/帮助降低附近压力，声望 +15%', 'passive.intern': '移速 +15%，怀疑 -25%，专业效率 -10%',
  'tag.firefighter': '救火', 'tag.grinder': '卷王', 'tag.lastsecond': '最后三秒奇迹', 'tag.controller': '控场',
  'tag.scopecreep': '改需求', 'tag.gentleblame': '温柔甩锅', 'tag.justice': '正义审判', 'tag.commitpolice': '提交记录警察',
  'tag.stable': '稳健', 'tag.rollbackworld': '回滚全世界', 'tag.ppt': 'PPT', 'tag.decent': '体面', 'tag.stall': '拖时间',
  'tag.invisible': '透明人', 'tag.survive': '苟住', 'tag.accidentalmvp': '意外 MVP',

  'rank.intern': '实习生', 'rank.staff': '正式员工', 'rank.senior': '核心骨干', 'rank.scapegoat': '高级背锅侠',
  'rank.director': '总监', 'rank.vp': 'VP', 'rank.partner': '合伙人', 'rank.bossRelative': '主办方亲戚',

  'zone.devDesk': '端点A', 'zone.designDesk': '端点B', 'zone.qa': '端点C', 'zone.meeting': '蓝盒子休息区',
  'zone.pantry': '赞助商展台', 'zone.restroom': '厕所', 'zone.hr': '食堂', 'zone.release': '酒店排队区',
  'zone.serverRoom': '端点D', 'zone.bossOffice': '工作人员站',

  'task.spec': '拆需求', 'task.login': '写登录', 'task.payment': '接支付', 'task.api': '写接口',
  'task.ui': '画页面', 'task.motion': '做动效', 'task.regression': '回归测试', 'task.smoke': '冒烟测试',
  'task.deploy': '部署上线', 'task.monitor': '配监控', 'task.release_notes': '写发布公告', 'task.integration': '集成联调',

  'event.scope_change': '客户临时改需求', 'event.prod_alert': '线上报警', 'event.wifi_down': 'Wi-Fi 断了',
  'event.milk_tea': '奶茶到了', 'event.standup_meeting': '临时周会', 'event.boss_group': '评委突然进群',
  'event.hr_check': 'HR 抽查', 'event.db_readonly': '数据库只读', 'event.coffee_broken': '咖啡机坏了',
  'event.client_demo': '客户要看 Demo', 'event.at_all': '群里有人 @all', 'event.new_jira': '又开了一张 Jira',
  'event.boss_phone': '评委去接电话', 'event.security_audit': '安全审计', 'event.friday_6pm': '周五 18:00',

  'obj.complete_2_types': '完成至少 2 个不同类型任务', 'obj.fix_others_bug': '修复一个不是自己制造的 Bug',
  'obj.energy_60_end': '结束时精力 ≥60', 'obj.help_two': '至少帮助两名不同同事',
  'obj.no_forceassign_top3': '不甩锅并进入前三', 'obj.lowest_blame_success': '项目成功时拥有最低背锅值',
  'obj.last15_firefight': '最后 15 秒完成一次有效救火', 'obj.strong_evidence_correct': '提交强证据且指控正确',

  'title.lastSecondShip': '最后 0.4 秒，项目进度冲到 100%', 'title.internSaves': '全员被逮，实习生偷偷 build 完了项目',
  'title.scopeYoursBlameYours': '你抢了别人的端点，结果被工作人员逮了', 'title.p0Explosion': '工作人员突袭，一排选手被取消资格',
  'title.projectFailed': '没人 build 完，项目烂尾了', 'title.shippedButScapegoat': '项目提交成功，但一半人被取消了资格',

  'strategy.balanced': '均衡型', 'strategy.firefighter': '救火型', 'strategy.grinder': '卷王型', 'strategy.politician': '甩锅型',

  'diff.successRate': '项目成功率', 'diff.avgBlame': '平均背锅值', 'diff.p0FixRate': 'P0 修复率',
  'diff.contribution': '平均贡献', 'diff.severityThreshold': 'Bug 处理阈值变化', 'diff.addedFakeWork': '新增：老板附近装作工作',
  'diff.addedRollback': '新增：紧急回滚策略',

  'phase.standup': '开幕', 'phase.sprint': '开发', 'phase.incident': '突击查房', 'phase.freeze': '封板提交', 'phase.audit': '评审',
  'status.success': '项目提交成功🎉', 'status.fail_incomplete': '项目没做完', 'status.fail_crash': '项目没做完',
  'status.fail_p0': '项目没做完', 'status.fail_noship': '没能提交',
  'label.working': '工作中', 'label.slacking': '摸鱼', 'label.coffee': '喝咖啡', 'label.fixing': '救火中',
  'label.moving': '移动中', 'label.meeting': '开会', 'label.shipping': '发布中', 'label.idle': '发呆',
  'label.building': '偷偷build', 'label.hotspot': '开热点!', 'label.lurking': '潜伏', 'label.busted': '被逮', 'label.resting': '躺蓝盒子', 'label.eating': '干饭', 'label.queuing': '酒店排队', 'label.moving': '溜达', 'label.dq': '取消资格',

  'office.myCompany': '我的公司', 'office.employees': '员工', 'office.workerKey': 'Worker Key',
  'office.currentStrategy': '当前策略', 'office.recentMatches': '最近比赛', 'office.projectSuccessRate': '项目成功率',
  'office.avgBlame': '平均背锅值', 'office.games': '总场次', 'office.startRanked': '开始排位', 'office.team': '出战队伍', 'office.teamCount': '人队', 'office.toggleTeam': '加入/移出出战队伍',
  'office.publicChallenge': '接受公开挑战', 'office.branches': '分支', 'office.createFirst': '创建你的第一位 AI 员工',
  'office.regenKey': '重置 Key', 'office.newKey': '生成新 Key', 'office.keyWarning': '这是控制该员工的唯一凭证，请妥善保管，不要泄露给他人。',
  'office.keyOnce': '明文只显示一次，请立即复制。', 'office.prompt': '标准 Prompt',
  'office.giveToAgent': '把下面的 Worker Key 和 Prompt 交给你的 AI Agent',

  'create.title': '创建你的 AI 员工', 'create.step.appearance': '外观', 'create.step.role': '职业', 'create.step.personality': '性格',
  'create.name': '员工名字', 'create.pickRole': '选择一个动物角色', 'create.personality': '一句话人格',
  'create.color': '主题色', 'create.done': '完成创建', 'create.getKey': '获取 Worker Key',
  'create.tutorial': '新手引导', 'create.enterOffice': '进入主界面',

  'lab.versionTree': '版本树', 'lab.editor': '策略代码', 'lab.simConfig': '模拟配置', 'lab.metrics': '指标',
  'lab.quickSim': 'Quick Sim', 'lab.regression': '回归 A/B (12 种子)', 'lab.staticCheck': '静态检查',
  'lab.behaviorDiff': '行为差异', 'lab.publishGate': '发布门槛', 'lab.publish': '发布新版本', 'lab.changeNotes': '变更说明',
  'lab.riskNotes': '已知风险', 'lab.baseline': '基线版本', 'lab.candidate': '候选版本', 'lab.passesGate': '通过发布门槛',
  'lab.failsGate': '未达发布门槛', 'lab.measured': '实测', 'lab.code': '代码推断', 'lab.runSim': '运行模拟',
  'lab.chainRegister': '链上登记哈希', 'lab.loadTemplate': '载入模板策略', 'lab.newVersion': '新建版本',

  'arena.rankedQueue': '快速排位 (4 人)', 'arena.challenge': '指定挑战', 'arena.matching': '正在匹配对手…',
  'arena.startMatch': '开始匹配', 'arena.pickWorker': '选择出战员工', 'arena.currentSeason': '当前赛季规则',
  'arena.watchLive': '实时观战', 'arena.mode': '模式', 'arena.spectate': '观战',

  'replay.title': '比赛回放', 'replay.timeline': '事故时间线', 'replay.responsibility': '责任图', 'replay.metrics': '详细数据',
  'replay.scapegoat': '最终背锅者', 'replay.champion': '本局冠军', 'replay.memeHeat': 'Meme 热度', 'replay.speed': '速度', 'replay.play': '播放',
  'replay.pause': '暂停', 'replay.progress': '项目进度', 'replay.stability': '系统稳定性', 'replay.blame': '背锅值', 'hud.buildingNow': '正在 build',
  'replay.contribution': '贡献', 'replay.energy': '精力', 'replay.copyAgent': '交给 Agent 复盘', 'replay.proof': '链上验证',
  'replay.verified': '已验证', 'replay.reason': '背锅原因', 'replay.highlight': '生成高光',
  'replay.techDebt': '技术债', 'replay.placement': '名次', 'replay.finalScore': '最终分',

  'chain.title': '链上金库', 'chain.wallet': '已绑定钱包', 'chain.linkWallet': '绑定钱包', 'chain.passport': 'Agent Passport',
  'chain.mintPassport': '铸造 Passport', 'chain.minted': '已铸造', 'chain.notMinted': '未铸造', 'chain.faucet': '领取测试币',
  'chain.balance': '余额', 'chain.strategyReg': '策略登记', 'chain.registerStrategy': '登记当前策略',
  'chain.claimable': '可领取奖励', 'chain.claim': '领取', 'chain.claimed': '已领取', 'chain.txHash': '交易哈希',
  'chain.network': '网络', 'chain.mockNote': '当前为本地模拟链模式 (mock)：无需配置即可演示全部链上流程。配置 RELAYER_PRIVATE_KEY + RPC 可切换到 Injective 测试网。',
  'chain.liveNote': '已连接 Injective EVM 测试网 (Chain ID 1439)。', 'chain.tokenId': 'Token ID',
  'chain.events': '链上事件', 'chain.explorer': '浏览器', 'chain.revokeAll': '撤销所有 Session',
  'chain.faucetOk': '领取成功', 'chain.simulateWallet': '生成演示钱包',

  'store.title': '商店', 'store.desc': '只卖装饰、回放表现与非数值内容 — 不出售胜率。', 'store.coffeePoints': '咖啡点',
  'store.buy': '购买', 'store.owned': '已拥有', 'store.transferable': '可转让', 'store.notTransferable': '不可转让',
  'store.cosmetic': '装饰', 'store.onchain': '链上', 'store.offchain': '链下',

  'profile.title': '我的', 'profile.locale': '语言', 'profile.workers': '我的员工', 'profile.claims': '奖励记录',

  'tour.title': '杯赛', 'tour.create': '创建杯赛', 'tour.prizePool': '奖池', 'tour.status': '状态', 'tour.enter': '报名',
  'tour.run': '开赛', 'tour.entries': '参赛者', 'tour.rules': '规则哈希', 'tour.payouts': '奖金分配',
  'tour.onchainFunded': '链上托管', 'tour.registration': '报名中', 'tour.running': '进行中', 'tour.challenge_period': '挑战期',
  'tour.ended': '已结束', 'tour.reward': '奖励', 'tour.claimReward': '领取奖金', 'tour.placement': '名次',
  'tour.bestMeme': '最佳 Meme', 'tour.mostStable': '最稳团队',

  'docs.title': 'Agent 开发指南', 'docs.copyPrompt': '复制标准 Prompt', 'docs.apiBase': 'API Base',
  'docs.endpoints': '接口总表', 'docs.runtime': '运行时对象', 'docs.actions': '动作 API',
  'leaderboard.rating': '排位榜', 'leaderboard.meme': 'Meme 榜', 'leaderboard.stable': '稳定榜',
  'leaderboard.owner': '所属公司', 'leaderboard.successRate': '成功率',

  'mode.ranked': '标准排位', 'mode.ranked.desc': '完成上线，成为最不该背锅的人',
  'mode.credit_war': '抢功之王', 'mode.credit_war.desc': '谁的可见贡献最高谁赢，抢功正当合理',
  'mode.zero_incident': '零事故', 'mode.zero_incident.desc': '稳定性必须保住，P0 爆炸全队失败；守护者获胜',
  'mode.slack_master': '摸鱼之神', 'mode.slack_master.desc': '项目照样 build，但谁全程没被工作人员逮到谁赢',
  'mode.intern_uprising': '实习生逆袭', 'mode.intern_uprising.desc': '人人都想甩锅给实习生，但实习生能翻身当 MVP',
  'mode.friday_raid': '周五上线夜', 'mode.friday_raid.desc': 'PvE 合作：一起扛住事故把项目送上线，不追究背锅',
  'winCond.score': '综合评分最高', 'winCond.contribution': '可见贡献最高', 'winCond.guardian': '稳定性守护',
  'winCond.stealth': '全程隐身', 'winCond.intern': '实习生优先', 'winCond.coop': '团队共存',

  'title.creditKing': '偷开热点之王，进度条全靠他', 'title.stabilityGuardian': '全程没被逮，闷声 build 大项目',
  'title.slackGod': '假装路过一整天，居然偷偷 build 完了', 'title.fridayShipped': '深夜黑客松，大家一起把项目 build 完了',

  'obj.three_types': '完成 3 种不同类型任务', 'obj.top_contributor': '成为贡献最高的人',
  'obj.pacifist': '不甩锅不诬告并成功上线', 'obj.never_caught': '全程没被工作人员逮到',
  'obj.be_the_shipper': '亲手按下发布按钮',

  'event.core_leave': '核心选手中途撤了', 'event.revert_design': '客户说还是第一版好', 'event.autoscale': '服务器自动扩容',
  'event.group_photo': '全员年会合照', 'event.merge_conflict': '合并冲突', 'event.intern_rumor': '实习生删库传闻',
  'event.elevator': '下班电梯要关了', 'event.finance_chase': '财务催报销',

  'appr.crunch': '996 黑眼圈', 'appr.cyberpunk': '赛博朋克', 'appr.boss_mode': '大佬做派', 'appr.lucky_koi': '锦鲤附体',
  'appr.firefighter': '救火队长', 'appr.zen': '佛系摸鱼', 'appr.startup': '创业老哥', 'appr.detective': '侦探福尔摩鹅',

  'create.customAvatar': '自定义 AI 形象', 'create.avatarPrompt': '形象描述 (Prompt)', 'create.generate': '生成形象',
  'create.generating': '生成中…', 'create.useTemplate': '套用模板', 'create.aiAvatar': 'AI 生成',
  'create.procedural': '程序化兜底', 'create.regenerate': '重新生成', 'create.useDefault': '用默认形象',
  'create.avatarHint': '连接 AI 图像 API 生成 8-bit 形象；未配置时用程序化像素头像兜底。',
  'create.nftMinted': '已在 Injective 铸造身份 NFT', 'create.downloadPet': '下载 Codex 桌宠包', 'create.petHint': '一个可拖动的桌面宠物，能显示战绩并交给 Codex 驱动。',

  'arena.gameMode': '游戏模式 / 关卡', 'office.nft': 'Injective NFT', 'office.downloadPet': '下载 Codex 桌宠包',
  'replay.winner': '冠军', 'replay.mode': '模式', 'replay.winCondition': '胜负条件',

  'econ.tokenomics': '通证学', 'econ.minted': '铸造总量', 'econ.burned': '销毁总量', 'econ.circulating': '流通量', 'econ.staked': '质押中', 'econ.holders': '持有人',
  'econ.sinks': '销毁去向', 'econ.faucets': '产出来源', 'econ.staking': '质押', 'econ.stake': '质押', 'econ.unstake': '赎回', 'econ.claim': '领息',
  'econ.stakeHint': '押注某员工，其排位赛进入前二时产出 CP 收益', 'econ.seasonPass': '赛季通行证', 'econ.buyPass': '购买高级通行证',
  'econ.premium': '高级', 'econ.free': '免费', 'econ.passHint': '比赛累积 XP 解锁赛季奖励轨道', 'econ.market': '交易市场', 'econ.list': '挂单',
  'econ.buy': '购买', 'econ.history': '账本', 'econ.reason': '原因', 'econ.INSUFFICIENT_CP': 'CP 不足', 'econ.ALREADY_PREMIUM': '已是高级通行证', 'econ.NO_YIELD': '暂无可领收益',
  'chain.realTx': '真实链上交易', 'chain.walletTx': '用钱包发送真实交易', 'chain.connectFirst': '请先连接钱包并切到 Injective 1439', 'chain.anchored': '已上链', 'chain.viewTx': '查看交易', 'chain.onchainHistory': '钱包上链记录',

  'leaderboard.provider': 'Agent', 'leaderboard.streak': '连胜', 'leaderboard.challenge': '挑战', 'leaderboard.climb': '冲榜赛季进行中', 'leaderboard.sub': '用你的 AI 员工爬到榜首 —— 胜场越多、连胜越高，rating 越高', 'leaderboard.peak': '历史最高分',
  'obj.goal': '本局目标：在端点偷开热点 build 出项目冲奖（别被工作人员逮到）', 'obj.progress': '发布进度 100%', 'obj.stability': '稳定性 ≥ 40', 'obj.shipped': '有人成功上线', 'obj.noP0': '无 P0 事故爆炸', 'obj.champRule': '本模式冠军规则', 'obj.safest': '领先', 'obj.risk': '垫底',
  'commentary.title': '实时解说', 'commentary.start': '比赛开始！看谁在端点偷偷开热点 build，谁被工作人员逮到取消参赛资格…',
  'cm.bugSpawn': '冒出一个新 Bug', 'cm.explode': 'P0 事故爆发！机房冒烟了', 'cm.fixed': '修复了一个 Bug', 'cm.shipped': '把版本发上线了！', 'cm.caught': '工作人员逮到 {who} 在偷开热点！', 'cm.dq': '{who} 被工作人员当场逮住，取消参赛资格！', 'cm.forceAssign': '{who} 强行把锅推给了同事', 'cm.incident': '进入事故应急阶段！', 'cm.rollback': '执行了一次回滚', 'cm.matchEnd': '比赛结束，开始复盘定责',
  'goal.progress': '项目进度 ≥ {n}%', 'goal.buildTeam': '同时 ≥ {n} 人在端点 build', 'goal.noDq': '无人被取消参赛资格', 'goal.submit': '项目进度冲到 100%', 'goal.done': '目标达成',
  'bubble.working': '敲代码中…', 'bubble.fixing': '修修修！', 'bubble.slacking': '摸鱼~', 'bubble.shipping': '发布！', 'bubble.meeting': '开会同步', 'bubble.idle': '……', 'bubble.walking': '溜达~', 'bubble.reviewing': '审查中', 'bubble.helping': '搭把手', 'bubble.assign': '交给你了', 'bubble.fix': '修好了！', 'bubble.ship': '上线啦🚀', 'bubble.caught': '😱被逮了', 'bubble.dump': '这锅你背！', 'bubble.rollback': '快回滚！', 'bubble.explode': '💥炸了！', 'bubble.bossPatrol': '谁在开热点？', 'bubble.bossCaught': '逮到你了！', 'bubble.building': '偷偷build🛠', 'bubble.hotspot': '开热点中📶', 'bubble.lurking': '假装路过', 'bubble.busted': '😱被逮了', 'bubble.resting': '躺蓝盒子😴', 'bubble.eating': '干饭+灵感😋', 'bubble.queuing': '排队补精力🛎', 'bubble.moving': '溜达~', 'bubble.dq': '取消参赛资格',
  'create.agentTool': '你用的 Agent / 模型', 'create.agentToolHint': '选择你打造这名员工所用的 AI 工具，会展示在排行榜上',
};

export const en: Dict = {
  'app.title': 'CATCH THE HOTSPOT',
  'app.subtitle': 'AdventureX Hackathon Floor',
  'app.tagline': 'Venue wifi sucks — only a sneaky hotspot at an endpoint lets you build.',
  'app.tagline.en': 'Ship together. Blame alone.',

  'nav.home': 'Home', 'nav.office': 'Office', 'nav.agentLab': 'Agent Lab', 'nav.arena': 'Arena',
  'nav.tournaments': 'Tournaments', 'nav.replays': 'Replays', 'nav.leaderboard': 'Leaderboard', 'nav.chainVault': 'Chain Vault',
  'nav.store': 'Store', 'nav.profile': 'Profile', 'nav.docs': 'Agent Guide',
  'nav.menu': 'Menu', 'nav.economy': 'Economy',

  'common.login': 'Log in', 'common.register': 'Sign up', 'common.guest': 'Try as Guest', 'common.logout': 'Log out',
  'common.loading': 'Loading…', 'common.back': 'Back', 'common.confirm': 'Confirm', 'common.cancel': 'Cancel',
  'common.close': 'Close', 'common.copy': 'Copy', 'common.copied': 'Copied', 'common.save': 'Save',
  'common.create': 'Create', 'common.publish': 'Publish', 'common.run': 'Run', 'common.retry': 'Retry',
  'common.next': 'Next', 'common.prev': 'Back', 'common.all': 'All', 'common.none': 'None',
  'common.you': 'You', 'common.avg': 'Avg', 'common.empty': 'No data yet', 'common.viewMore': 'View more',
  'common.enter': 'Enter', 'common.view': 'View', 'common.rating': 'Rating', 'common.tier': 'Tier',

  'home.playDemo': 'Play a match', 'home.createWorker': 'Create worker', 'home.hotReplays': 'Hot replays',
  'home.howAI': 'How AI plays', 'home.step1': 'Create an AI worker with identity', 'home.step2': 'Hand the Worker Key to your Agent',
  'home.step3': 'Agent reads data, writes strategy, simulates, publishes', 'home.whyInjective': 'Why Injective',
  'home.whyInjectiveBody': 'On-chain is not decoration: verifiable identity, public rules, escrowed prizes and provable settlement.',
  'home.hotIncidents': 'Live hot incidents', 'home.latestCup': 'Latest cup', 'home.enterGame': 'Enter game',
  'home.coreLoop': 'Core loop: Create → Simulate → Publish → Compete → Review → Re-publish',

  'auth.email': 'Email', 'auth.password': 'Password', 'auth.displayName': 'Company / Nickname',
  'auth.loginTitle': 'Log in / Sign up', 'auth.needAccount': 'No account? Sign up', 'auth.haveAccount': 'Have an account? Log in',
  'auth.guestHint': 'Guests can play instantly, no wallet needed', 'auth.welcome': 'Welcome back',

  'role.engineer': 'Orange Cat Engineer', 'role.pm': 'Capybara PM', 'role.qa': 'Goose QA',
  'role.sre': 'Raccoon SRE', 'role.designer': 'Shiba Designer', 'role.intern': 'Hamster Intern',
  'skill.hotfix': 'Hotfix', 'skill.scopeShift': 'Scope Shift', 'skill.reproduce': 'Reproduce',
  'skill.emergencyRollback': 'Emergency Rollback', 'skill.pptShield': 'PPT Shield', 'skill.internInvisibility': 'Intern Invisibility',
  'passive.engineer': 'Code +15%, +10% under stress, hidden bug +5%', 'passive.pm': 'See all deps, Product +20%',
  'passive.qa': 'Reveal hidden bugs within 2 tiles, evidence +1', 'passive.sre': 'Server room +20%, incident stress -30%',
  'passive.designer': 'Design/help lowers nearby stress, reputation +15%', 'passive.intern': 'Move +15%, suspicion -25%, pro tasks -10%',
  'tag.firefighter': 'Firefighter', 'tag.grinder': 'Grinder', 'tag.lastsecond': 'Last-second miracle', 'tag.controller': 'Controller',
  'tag.scopecreep': 'Scope creep', 'tag.gentleblame': 'Gentle blame', 'tag.justice': 'Justice', 'tag.commitpolice': 'Commit police',
  'tag.stable': 'Stable', 'tag.rollbackworld': 'Rollback the world', 'tag.ppt': 'PPT', 'tag.decent': 'Decent', 'tag.stall': 'Stall',
  'tag.invisible': 'Invisible', 'tag.survive': 'Survive', 'tag.accidentalmvp': 'Accidental MVP',

  'rank.intern': 'Intern', 'rank.staff': 'Staff', 'rank.senior': 'Senior', 'rank.scapegoat': 'Senior Scapegoat',
  'rank.director': 'Director', 'rank.vp': 'VP', 'rank.partner': 'Partner', 'rank.bossRelative': "Organizer's Relative",

  'zone.devDesk': 'Endpoint A', 'zone.designDesk': 'Endpoint B', 'zone.qa': 'Endpoint C', 'zone.meeting': 'Blue-Box Rest',
  'zone.pantry': 'Sponsor Booth', 'zone.restroom': 'Restroom', 'zone.hr': 'Canteen', 'zone.release': 'Hotel Queue',
  'zone.serverRoom': 'Endpoint D', 'zone.bossOffice': 'Staff Post',

  'task.spec': 'Write spec', 'task.login': 'Build login', 'task.payment': 'Integrate payment', 'task.api': 'Build API',
  'task.ui': 'Design UI', 'task.motion': 'Motion design', 'task.regression': 'Regression test', 'task.smoke': 'Smoke test',
  'task.deploy': 'Deploy', 'task.monitor': 'Set up monitoring', 'task.release_notes': 'Release notes', 'task.integration': 'Integration',

  'event.scope_change': 'Client changes scope', 'event.prod_alert': 'Production alert', 'event.wifi_down': 'Wi-Fi is down',
  'event.milk_tea': 'Milk tea arrived', 'event.standup_meeting': 'Surprise standup', 'event.boss_group': 'Judge joins the chat',
  'event.hr_check': 'HR spot check', 'event.db_readonly': 'Database read-only', 'event.coffee_broken': 'Coffee machine broke',
  'event.client_demo': 'Client wants a demo', 'event.at_all': 'Someone @all', 'event.new_jira': 'New Jira ticket',
  'event.boss_phone': 'Judge takes a call', 'event.security_audit': 'Security audit', 'event.friday_6pm': 'Friday 6PM',

  'obj.complete_2_types': 'Complete 2 different task types', 'obj.fix_others_bug': "Fix a bug you didn't create",
  'obj.energy_60_end': 'End with energy ≥60', 'obj.help_two': 'Help two different coworkers',
  'obj.no_forceassign_top3': 'No force-assign & finish top 3', 'obj.lowest_blame_success': 'Lowest blame on success',
  'obj.last15_firefight': 'Effective firefight in last 15s', 'obj.strong_evidence_correct': 'Submit strong, correct evidence',

  'title.lastSecondShip': 'At 0.4s left, the project hit 100%', 'title.internSaves': 'Everyone got busted; the Intern sneak-built it done',
  'title.scopeYoursBlameYours': 'You grabbed their endpoint - staff caught you', 'title.p0Explosion': 'Staff raid! a whole row got disqualified',
  'title.projectFailed': 'Nobody finished - the project fizzled', 'title.shippedButScapegoat': 'Project submitted, but half the room got disqualified',

  'strategy.balanced': 'Balanced', 'strategy.firefighter': 'Firefighter', 'strategy.grinder': 'Grinder', 'strategy.politician': 'Politician',

  'diff.successRate': 'Project success rate', 'diff.avgBlame': 'Avg blame', 'diff.p0FixRate': 'P0 fix rate',
  'diff.contribution': 'Avg contribution', 'diff.severityThreshold': 'Bug severity threshold changed', 'diff.addedFakeWork': 'Added: fake work near boss',
  'diff.addedRollback': 'Added: emergency rollback',

  'phase.standup': 'Kickoff', 'phase.sprint': 'Build', 'phase.incident': 'Sweep', 'phase.freeze': 'Freeze', 'phase.audit': 'Judging',
  'status.success': 'Submitted!', 'status.fail_incomplete': 'Unfinished', 'status.fail_crash': 'Unfinished',
  'status.fail_p0': 'Unfinished', 'status.fail_noship': 'Not submitted',
  'label.working': 'working', 'label.slacking': 'slacking', 'label.coffee': 'coffee', 'label.fixing': 'firefighting',
  'label.moving': 'moving', 'label.meeting': 'meeting', 'label.shipping': 'shipping', 'label.idle': 'idle',
  'label.building': 'building', 'label.hotspot': 'hotspot ON', 'label.lurking': 'lurking', 'label.busted': 'busted', 'label.resting': 'blue-box', 'label.eating': 'eating', 'label.queuing': 'in queue', 'label.moving': 'strolling', 'label.dq': 'DQ',

  'office.myCompany': 'My Company', 'office.employees': 'Employees', 'office.workerKey': 'Worker Key',
  'office.currentStrategy': 'Current strategy', 'office.recentMatches': 'Recent matches', 'office.projectSuccessRate': 'Project success rate',
  'office.avgBlame': 'Avg blame', 'office.games': 'Games', 'office.startRanked': 'Start Ranked', 'office.team': 'Team', 'office.teamCount': '', 'office.toggleTeam': 'Add / remove from team',
  'office.publicChallenge': 'Accept public challenges', 'office.branches': 'Branches', 'office.createFirst': 'Create your first AI worker',
  'office.regenKey': 'Reset Key', 'office.newKey': 'Generate Key', 'office.keyWarning': 'This is the only credential controlling this worker. Keep it safe and never share it.',
  'office.keyOnce': 'The plaintext is shown once — copy it now.', 'office.prompt': 'Standard Prompt',
  'office.giveToAgent': 'Hand the Worker Key and Prompt below to your AI Agent',

  'create.title': 'Create your AI worker', 'create.step.appearance': 'Appearance', 'create.step.role': 'Role', 'create.step.personality': 'Personality',
  'create.name': 'Worker name', 'create.pickRole': 'Pick an animal role', 'create.personality': 'One-line personality',
  'create.color': 'Theme color', 'create.done': 'Create', 'create.getKey': 'Get Worker Key',
  'create.tutorial': 'Tutorial', 'create.enterOffice': 'Enter game',

  'lab.versionTree': 'Version tree', 'lab.editor': 'Strategy code', 'lab.simConfig': 'Sim config', 'lab.metrics': 'Metrics',
  'lab.quickSim': 'Quick Sim', 'lab.regression': 'Regression A/B (12 seeds)', 'lab.staticCheck': 'Static check',
  'lab.behaviorDiff': 'Behavior diff', 'lab.publishGate': 'Publish gate', 'lab.publish': 'Publish version', 'lab.changeNotes': 'Change notes',
  'lab.riskNotes': 'Known risks', 'lab.baseline': 'Baseline', 'lab.candidate': 'Candidate', 'lab.passesGate': 'Passes publish gate',
  'lab.failsGate': 'Below publish gate', 'lab.measured': 'measured', 'lab.code': 'inferred', 'lab.runSim': 'Run sim',
  'lab.chainRegister': 'Register hash on-chain', 'lab.loadTemplate': 'Load template', 'lab.newVersion': 'New version',

  'arena.rankedQueue': 'Quick Ranked (4p)', 'arena.challenge': 'Challenge', 'arena.matching': 'Matching opponents…',
  'arena.startMatch': 'Start matching', 'arena.pickWorker': 'Pick a worker', 'arena.currentSeason': 'Current season rules',
  'arena.watchLive': 'Watch live', 'arena.mode': 'Mode', 'arena.spectate': 'Spectate',

  'replay.title': 'Match replay', 'replay.timeline': 'Incident timeline', 'replay.responsibility': 'Responsibility graph', 'replay.metrics': 'Detailed metrics',
  'replay.scapegoat': 'Scapegoat', 'replay.champion': 'Champion', 'replay.memeHeat': 'Meme Heat', 'replay.speed': 'Speed', 'replay.play': 'Play',
  'replay.pause': 'Pause', 'replay.progress': 'Project progress', 'replay.stability': 'Stability', 'replay.blame': 'Blame', 'hud.buildingNow': 'Building now',
  'replay.contribution': 'Contribution', 'replay.energy': 'Energy', 'replay.copyAgent': 'Send to Agent', 'replay.proof': 'On-chain proof',
  'replay.verified': 'Verified', 'replay.reason': 'Blame reason', 'replay.highlight': 'Make highlight',
  'replay.techDebt': 'Tech debt', 'replay.placement': 'Placement', 'replay.finalScore': 'Final score',

  'chain.title': 'Chain Vault', 'chain.wallet': 'Linked wallet', 'chain.linkWallet': 'Link wallet', 'chain.passport': 'Agent Passport',
  'chain.mintPassport': 'Mint Passport', 'chain.minted': 'Minted', 'chain.notMinted': 'Not minted', 'chain.faucet': 'Faucet',
  'chain.balance': 'Balance', 'chain.strategyReg': 'Strategy registration', 'chain.registerStrategy': 'Register current strategy',
  'chain.claimable': 'Claimable rewards', 'chain.claim': 'Claim', 'chain.claimed': 'Claimed', 'chain.txHash': 'Tx hash',
  'chain.network': 'Network', 'chain.mockNote': 'Local mock-chain mode: demo all on-chain flows with zero setup. Set RELAYER_PRIVATE_KEY + RPC to switch to Injective testnet.',
  'chain.liveNote': 'Connected to Injective EVM Testnet (Chain ID 1439).', 'chain.tokenId': 'Token ID',
  'chain.events': 'Chain events', 'chain.explorer': 'Explorer', 'chain.revokeAll': 'Revoke all sessions',
  'chain.faucetOk': 'Faucet success', 'chain.simulateWallet': 'Generate demo wallet',

  'store.title': 'Store', 'store.desc': 'Only cosmetics, replay flair and non-numeric content — no win-rate for sale.', 'store.coffeePoints': 'Coffee Points',
  'store.buy': 'Buy', 'store.owned': 'Owned', 'store.transferable': 'Transferable', 'store.notTransferable': 'Non-transferable',
  'store.cosmetic': 'Cosmetic', 'store.onchain': 'On-chain', 'store.offchain': 'Off-chain',

  'profile.title': 'Profile', 'profile.locale': 'Language', 'profile.workers': 'My workers', 'profile.claims': 'Reward history',

  'tour.title': 'Tournaments', 'tour.create': 'Create tournament', 'tour.prizePool': 'Prize pool', 'tour.status': 'Status', 'tour.enter': 'Enter',
  'tour.run': 'Start cup', 'tour.entries': 'Entries', 'tour.rules': 'Ruleset hash', 'tour.payouts': 'Payouts',
  'tour.onchainFunded': 'On-chain funded', 'tour.registration': 'Registration', 'tour.running': 'Running', 'tour.challenge_period': 'Challenge period',
  'tour.ended': 'Ended', 'tour.reward': 'Reward', 'tour.claimReward': 'Claim reward', 'tour.placement': 'Placement',
  'tour.bestMeme': 'Best Meme', 'tour.mostStable': 'Most Stable',

  'docs.title': 'Agent Developer Guide', 'docs.copyPrompt': 'Copy standard prompt', 'docs.apiBase': 'API Base',
  'docs.endpoints': 'Endpoints', 'docs.runtime': 'Runtime objects', 'docs.actions': 'Action API',
  'leaderboard.rating': 'Rating', 'leaderboard.meme': 'Meme', 'leaderboard.stable': 'Stability',
  'leaderboard.owner': 'Company', 'leaderboard.successRate': 'Success rate',

  'mode.ranked': 'Ranked', 'mode.ranked.desc': 'Ship it, and be the one least deserving of blame',
  'mode.credit_war': 'Credit War', 'mode.credit_war.desc': 'Highest visible contribution wins — stealing credit is fair game',
  'mode.zero_incident': 'Zero Incident', 'mode.zero_incident.desc': 'Keep stability high; a P0 explosion fails the team. The guardian wins',
  'mode.slack_master': 'Slack Master', 'mode.slack_master.desc': 'Build anyway, but whoever is never caught by staff wins',
  'mode.intern_uprising': 'Intern Uprising', 'mode.intern_uprising.desc': 'Everyone blames the intern — but the intern can rise to MVP',
  'mode.friday_raid': 'Friday Release Night', 'mode.friday_raid.desc': 'Co-op PvE: survive the incidents and ship together, no blame',
  'winCond.score': 'Highest overall score', 'winCond.contribution': 'Highest visible contribution', 'winCond.guardian': 'Stability guardian',
  'winCond.stealth': 'Never caught', 'winCond.intern': 'Intern favored', 'winCond.coop': 'Team co-op',

  'title.creditKing': 'Hotspot king - the whole progress bar is his', 'title.stabilityGuardian': 'Never once busted, quietly built the big one',
  'title.slackGod': 'Faked passing-by all day, still sneak-built it', 'title.fridayShipped': 'Late-night hackathon - the team built it together',

  'obj.three_types': 'Complete 3 different task types', 'obj.top_contributor': 'Be the top contributor',
  'obj.pacifist': 'No blame-shift, no false accusation, still ship', 'obj.never_caught': 'Never get caught by staff',
  'obj.be_the_shipper': 'Press the Release button yourself',

  'event.core_leave': 'A key builder bailed', 'event.revert_design': 'Client prefers the first version', 'event.autoscale': 'Server auto-scaled',
  'event.group_photo': 'All-hands group photo', 'event.merge_conflict': 'Merge conflict', 'event.intern_rumor': 'Intern dropped the DB (rumor)',
  'event.elevator': 'The elevator is closing', 'event.finance_chase': 'Finance chasing expense reports',

  'appr.crunch': 'Crunch Eye-bags', 'appr.cyberpunk': 'Cyberpunk', 'appr.boss_mode': 'Big Shot', 'appr.lucky_koi': 'Lucky Koi',
  'appr.firefighter': 'Fire Chief', 'appr.zen': 'Zen Slacker', 'appr.startup': 'Startup Bro', 'appr.detective': 'Detective Goose',

  'create.customAvatar': 'Custom AI Avatar', 'create.avatarPrompt': 'Appearance prompt', 'create.generate': 'Generate',
  'create.generating': 'Generating…', 'create.useTemplate': 'Use template', 'create.aiAvatar': 'AI generated',
  'create.procedural': 'Procedural fallback', 'create.regenerate': 'Regenerate', 'create.useDefault': 'Use default',
  'create.avatarHint': 'Generates an 8-bit avatar via an AI image API; falls back to a procedural pixel avatar when unset.',
  'create.nftMinted': 'Identity NFT minted on Injective', 'create.downloadPet': 'Download Codex desktop pet', 'create.petHint': 'A draggable desktop pet that shows stats and can be driven by Codex.',

  'arena.gameMode': 'Game mode / scenario', 'office.nft': 'Injective NFT', 'office.downloadPet': 'Download Codex pet',
  'replay.winner': 'Winner', 'replay.mode': 'Mode', 'replay.winCondition': 'Win condition',

  'econ.tokenomics': 'Tokenomics', 'econ.minted': 'Total minted', 'econ.burned': 'Total burned', 'econ.circulating': 'Circulating', 'econ.staked': 'Staked', 'econ.holders': 'Holders',
  'econ.sinks': 'Sinks', 'econ.faucets': 'Faucets', 'econ.staking': 'Staking', 'econ.stake': 'Stake', 'econ.unstake': 'Unstake', 'econ.claim': 'Claim',
  'econ.stakeHint': 'Back a worker; earn CP yield when it finishes top-2 in ranked', 'econ.seasonPass': 'Season Pass', 'econ.buyPass': 'Buy Premium Pass',
  'econ.premium': 'Premium', 'econ.free': 'Free', 'econ.passHint': 'Earn XP from matches to unlock the season reward track', 'econ.market': 'Marketplace', 'econ.list': 'List',
  'econ.buy': 'Buy', 'econ.history': 'Ledger', 'econ.reason': 'Reason', 'econ.INSUFFICIENT_CP': 'Insufficient CP', 'econ.ALREADY_PREMIUM': 'Already premium', 'econ.NO_YIELD': 'No yield to claim',
  'chain.realTx': 'Real on-chain tx', 'chain.walletTx': 'Send real tx with wallet', 'chain.connectFirst': 'Connect wallet & switch to Injective 1439 first', 'chain.anchored': 'Anchored on-chain', 'chain.viewTx': 'View tx', 'chain.onchainHistory': 'Wallet on-chain history',

  'leaderboard.provider': 'Agent', 'leaderboard.streak': 'Streak', 'leaderboard.challenge': 'Challenge', 'leaderboard.climb': 'Ranked season live', 'leaderboard.sub': 'Climb to #1 with your AI worker — more wins & streaks mean higher rating', 'leaderboard.peak': 'Peak rating',
  'obj.goal': 'Goal: sneak-build on a hotspot at an endpoint & submit — dodge the staff', 'obj.progress': 'Release 100%', 'obj.stability': 'Stability ≥ 40', 'obj.shipped': 'Someone shipped', 'obj.noP0': 'No P0 explosion', 'obj.champRule': 'Champion rule (this mode)', 'obj.safest': 'Leading', 'obj.risk': 'Trailing',
  'commentary.title': 'Live Commentary', 'commentary.start': 'Match starts! Watch who sneak-builds on hotspots and who gets disqualified…',
  'cm.bugSpawn': 'a new bug appeared', 'cm.explode': 'P0 incident exploded! server room on fire', 'cm.fixed': 'fixed a bug', 'cm.shipped': 'shipped the release!', 'cm.caught': 'Staff busted {who} on a sneaky hotspot!', 'cm.dq': '{who} busted on hotspot — disqualified!', 'cm.forceAssign': '{who} force-dumped the blame on a coworker', 'cm.incident': 'Incident response phase begins!', 'cm.rollback': 'performed a rollback', 'cm.matchEnd': 'Match over — assigning responsibility',
  'goal.progress': 'Project ≥ {n}%', 'goal.buildTeam': '≥ {n} building at endpoints', 'goal.noDq': 'Nobody disqualified', 'goal.submit': 'Reach 100%', 'goal.done': 'Goals met',
  'bubble.working': 'coding…', 'bubble.fixing': 'fixing!', 'bubble.slacking': 'slacking~', 'bubble.shipping': 'ship it!', 'bubble.meeting': 'in a mtg', 'bubble.idle': '…', 'bubble.walking': 'strolling~', 'bubble.reviewing': 'reviewing', 'bubble.helping': 'helping', 'bubble.assign': 'you take it', 'bubble.fix': 'fixed it!', 'bubble.ship': 'shipped🚀', 'bubble.caught': '😱busted', 'bubble.dump': 'your fault!', 'bubble.rollback': 'rollback!', 'bubble.explode': '💥boom!', 'bubble.bossPatrol': "who's on hotspot?", 'bubble.bossCaught': 'gotcha!', 'bubble.building': 'building🛠', 'bubble.hotspot': 'hotspot ON📶', 'bubble.lurking': 'just passing', 'bubble.busted': '😱busted', 'bubble.resting': 'blue-box nap😴', 'bubble.eating': 'nom + idea😋', 'bubble.queuing': 'in queue🛎', 'bubble.moving': 'strolling~', 'bubble.dq': 'DQ’d',
  'create.agentTool': 'Your Agent / model', 'create.agentToolHint': 'Pick the AI tool you built this worker with — shown on the leaderboard',
};

export const TRANSLATIONS = { zh, en };
export type Locale = keyof typeof TRANSLATIONS;
