// Few-shot Examples Service
// 管理和提供高质量的写作示例
// 用于提升AI生成质量

export interface FewShotExample {
  id: string;
  category: string; // scene-draft, dialogue, action, description
  sceneType: string; // 场景类型：对话、动作、描写等
  purpose: string; // 场景目的
  example: string; // 示例内容
  quality: number; // 质量评分 0-100
  tags: string[]; // 标签
}

export class FewShotExamplesService {
  // Few-Shot示例库：用于提升AI生成质量的参考范文
  // 这些示例不是硬编码的输出，而是用于指导AI的写作风格
  private examples: FewShotExample[] = [
    // 对话场景示例
    {
      id: "dialogue-1",
      category: "scene-draft",
      sceneType: "对话",
      purpose: "角色冲突对话",
      example: `林轩推开门，看到师兄正背对着他站在窗前。

"你来了。"师兄的声音很平静，却让林轩心头一紧。

"师兄，我……"

"不用解释。"师兄转过身，眼中闪过一丝失望，"我只问你一句，那块玉佩，是不是你拿的？"

林轩握紧拳头，指甲陷入掌心。他知道，这一刻终于来了。

"是我。"他抬起头，直视师兄的眼睛，"但我有不得已的苦衷。"

"苦衷？"师兄冷笑一声，"为了你的苦衷，就可以背叛师门？"

空气仿佛凝固了。林轩深吸一口气，缓缓开口："师兄，如果有一天，你面临同样的选择，你会怎么做？"`,
      quality: 95,
      tags: ["对话", "冲突", "情感"],
    },
    // 动作场景示例
    {
      id: "action-1",
      category: "scene-draft",
      sceneType: "动作",
      purpose: "战斗场景",
      example: `剑光如电，直刺而来。

林轩侧身闪避，长剑擦着衣襟而过。他脚下一点，身形暴退三丈，手中剑诀已然变换。

"破！"

一道剑气破空而出，直取对方咽喉。黑衣人冷哼一声，手中黑刀横扫，将剑气震散。

两人身形交错，刀剑相击，火花四溅。

林轩感觉虎口发麻，心中暗惊。这黑衣人的实力，竟然在他之上！

不能再拖了。他咬牙，体内灵力疯狂涌动，剑身泛起青光。

"天罡剑诀，第三式——"

话音未落，他已化作一道青色流光，直冲而上。`,
      quality: 92,
      tags: ["动作", "战斗", "节奏"],
    },
    // 环境描写示例
    {
      id: "description-1",
      category: "scene-draft",
      sceneType: "描写",
      purpose: "环境氛围营造",
      example: `夜色如墨，月光透过树梢洒下斑驳的光影。

林轩独自走在山道上，周围静得可怕，只有风吹过树叶的沙沙声。远处偶尔传来几声兽吼，让这寂静的夜晚更添几分诡异。

他握紧手中的剑，目光警惕地扫视四周。师父说过，这片林子里有妖兽出没，尤其是在月圆之夜。

突然，一阵阴风吹过，林轩浑身一颤。不对劲。

空气中弥漫着淡淡的血腥味，混杂着某种腐臭的气息。他停下脚步，屏住呼吸，仔细感知周围的动静。

树林深处，似乎有什么东西在移动。`,
      quality: 90,
      tags: ["描写", "氛围", "悬念"],
    },
    // 心理描写示例
    {
      id: "psychology-1",
      category: "scene-draft",
      sceneType: "心理",
      purpose: "角色内心刻画",
      example: `林轩站在悬崖边，看着脚下万丈深渊，心中五味杂陈。

跳下去，或许就能解脱了。不用再面对师门的责难，不用再承受众人的白眼，不用再为那些无法改变的过去而痛苦。

可是……

他想起了师父临终前的嘱托，想起了小师妹信任的眼神，想起了那些还未完成的承诺。

"我不能死。"他喃喃自语，"至少，不能现在死。"

拳头紧握，指甲陷入掌心，疼痛让他清醒了几分。是啊，他还有太多事情没做，怎么能就这样放弃？

林轩深吸一口气，转身离开悬崖。

既然活着，就要活得有意义。`,
      quality: 93,
      tags: ["心理", "情感", "转折"],
    },
    // 发现线索示例
    {
      id: "discovery-1",
      category: "scene-draft",
      sceneType: "发现",
      purpose: "发现关键线索",
      example: `林轩翻开那本泛黄的古籍，指尖轻轻拂过书页。

突然，一行小字映入眼帘——"天机不可泄露，唯有血脉相承者方可入内。"

他心头一震。这不正是师父临终前说的那句话吗？

"血脉相承..."林轩喃喃自语，脑海中闪过无数念头。如果这本古籍记载的是真的，那么那座传说中的古墓，或许真的存在。

他仔细查看书页，发现边角处还有一行更小的字："北山之巅，月圆之夜，血祭开门。"

林轩合上书，眼中闪过一丝坚定。无论如何，他都要去一探究竟。`,
      quality: 91,
      tags: ["发现", "线索", "悬念"],
    },
    // 修炼突破示例
    {
      id: "breakthrough-1",
      category: "scene-draft",
      sceneType: "修炼",
      purpose: "修炼突破",
      example: `盘坐在洞府中，林轩闭目凝神，体内灵力如江河奔涌。

瓶颈就在眼前。他已经在筑基期巅峰停留了三年，今天，必须突破！

灵力在经脉中疯狂运转，一遍又一遍冲击着那道无形的屏障。汗水顺着额头滑落，林轩咬紧牙关，不敢有丝毫松懈。

"破！"

一声低喝，体内灵力骤然爆发。那道困扰他三年的屏障，终于出现了一丝裂痕。

林轩抓住机会，将所有灵力汇聚一处，全力冲击。

"轰——"

仿佛有什么东西碎裂了。下一刻，磅礴的灵力如潮水般涌入，林轩只觉得浑身经脉都在欢呼雀跃。

金丹期，成了！`,
      quality: 94,
      tags: ["修炼", "突破", "成长"],
    },
    // 情感告白示例
    {
      id: "confession-1",
      category: "scene-draft",
      sceneType: "情感",
      purpose: "情感表达",
      example: `月光下，林轩和苏婉并肩站在湖边。

"婉儿。"他轻声开口，声音有些颤抖。

"嗯？"苏婉转过头，月光映照下，她的侧脸美得让人心动。

林轩深吸一口气，鼓起勇气："我有话想对你说。"

"什么话？"

"我……"话到嘴边，却又说不出口。林轩握紧拳头，心跳如擂鼓。

苏婉似乎察觉到了什么，脸上浮现一抹红晕。她低下头，轻声说："我在听。"

"我喜欢你。"林轩终于说出了口，"从很久以前就喜欢你了。"

空气仿佛凝固了。良久，苏婉才抬起头，眼中闪着泪光："傻瓜，我还以为你永远不会说呢。"`,
      quality: 92,
      tags: ["情感", "告白", "氛围"],
    },
    // 阴谋揭露示例
    {
      id: "conspiracy-1",
      category: "scene-draft",
      sceneType: "揭露",
      purpose: "揭露阴谋",
      example: `"所以，这一切都是你安排的？"林轩盯着眼前的师兄，声音冰冷。

师兄脸上挂着淡淡的笑容："你终于发现了。不过，发现得太晚了。"

"为什么？"林轩握紧拳头，"师父待你不薄，你为什么要背叛师门？"

"不薄？"师兄冷笑一声，"他把最好的功法传给你，把掌门之位留给你，我呢？我辛苦修炼二十年，换来的只是一句'你资质不够'！"

林轩心头一沉。原来如此。

"所以你勾结魔道，害死师父，就是为了报复？"

"报复？"师兄摇摇头，"我只是在拿回本该属于我的东西。林轩，你太天真了。这个世界，从来都是强者为尊。"

他抬起手，掌心黑气涌动："现在，该送你上路了。"`,
      quality: 95,
      tags: ["揭露", "反转", "冲突"],
    },
    // 危机时刻示例
    {
      id: "crisis-1",
      category: "scene-draft",
      sceneType: "危机",
      purpose: "危机时刻",
      example: `"不好！"林轩脸色大变。

前方的山道突然崩塌，巨石如雨点般砸落。他脚下一点，身形暴退，却发现身后也有山石滚落，退路已断！

左右都是悬崖，上方是落石，下方是深渊。

绝境！

林轩咬牙，体内灵力疯狂涌动。生死关头，他顾不得保留实力了。

"天罡剑诀，第五式——破空！"

剑光冲天而起，硬生生在落石中劈出一条通道。林轩抓住机会，身形如电，冲向那唯一的生路。

"轰隆——"

身后山石轰然倒塌，烟尘四起。林轩落地的瞬间，一口鲜血喷出。

他撑着剑站起身，回头看了一眼已经面目全非的山道，心有余悸。

差一点，就死在这里了。`,
      quality: 93,
      tags: ["危机", "紧张", "动作"],
    },
    // 智斗示例
    {
      id: "strategy-1",
      category: "scene-draft",
      sceneType: "智斗",
      purpose: "智慧对决",
      example: `"你以为我会上当？"对方冷笑。

林轩心中一沉，但脸上不动声色："上不上当，试试就知道了。"

"试？"对方眯起眼睛，"你觉得我会给你机会？"

"不需要你给。"林轩突然笑了，"因为你已经中计了。"

对方脸色一变："什么意思？"

"你刚才说的话，已经暴露了你的身份。"林轩缓缓开口，"只有当年在场的三个人知道那件事，师父已死，我是第二个，那么你……"

"你是第三个。"

对方的脸色彻底变了。他意识到，自己说漏了嘴。

林轩继续道："你一直装作不知情，就是为了让我放松警惕。可惜，你太急了。"

空气凝固了几秒。

"好。"对方突然笑了，"不愧是师父的得意弟子。既然被你识破，那就别怪我不客气了。"`,
      quality: 94,
      tags: ["智斗", "推理", "反转"],
    },
    // 团队协作示例
    {
      id: "teamwork-1",
      category: "scene-draft",
      sceneType: "协作",
      purpose: "团队配合",
      example: `"准备好了吗？"林轩低声问道。

"随时可以。"苏婉点点头，手中长剑泛起寒光。

"我数三声，一起上。"林轩深吸一口气，"记住，目标是那个黑衣人，不要恋战。"

"明白。"

"三、二、一——动手！"

话音刚落，两人同时出手。林轩从正面攻击，剑光如虹；苏婉从侧翼包抄，剑气如霜。

黑衣人冷哼一声，黑刀横扫，将两人的攻击尽数挡下。

"就这点本事？"

"还没完呢！"林轩大喝一声，剑诀突变，"婉儿，青龙阵！"

"收到！"

两人身形交错，剑光交织成网，将黑衣人困在其中。这是他们练习了无数次的合击阵法，配合默契无间。

黑衣人脸色终于变了："该死！"`,
      quality: 91,
      tags: ["协作", "战斗", "配合"],
    },
    // 回忆杀示例
    {
      id: "flashback-1",
      category: "scene-draft",
      sceneType: "回忆",
      purpose: "回忆往事",
      example: `看着手中的玉佩，林轩陷入了回忆。

那是十年前的夏天。

"师父，这是什么？"年幼的他好奇地问道。

师父笑着摸了摸他的头："这是我们一脉相传的信物。等你长大了，就传给你。"

"真的吗？"小林轩眼睛一亮。

"当然。"师父的笑容很温暖，"不过，你要答应师父，无论将来遇到什么困难，都不要放弃。"

"我保证！"

那时的阳光很暖，师父的笑容也很暖。林轩以为，这样的日子会一直持续下去。

可是他错了。

三年后，师父死在了那场浩劫中，临终前将玉佩交到他手上："记住你的承诺。"

林轩握紧玉佩，眼眶微红。师父，我没有忘记。`,
      quality: 92,
      tags: ["回忆", "情感", "伏笔"],
    },
    // 悬念铺垫示例
    {
      id: "suspense-1",
      category: "scene-draft",
      sceneType: "悬念",
      purpose: "铺垫悬念",
      example: `林轩推开房门，屋内一片漆黑。

奇怪，小师妹明明说在这里等他，怎么会没人？

他点燃烛火，借着微弱的光线打量四周。房间很整洁，没有打斗的痕迹，桌上还摆着半杯茶，茶水还温着。

说明小师妹刚离开不久。

可是，她为什么要突然离开？

林轩走到桌前，突然发现茶杯下压着一张纸条。他拿起来一看，瞳孔骤然收缩。

纸上只有四个字："不要相信他。"

笔迹是小师妹的，但字迹潦草，显然是匆忙写下的。

不要相信谁？

林轩心中警铃大作。他转身想要离开，却发现门口站着一个人。

"师兄，你来了。"那人笑着说。

林轩握紧剑柄，眼中闪过一丝警惕。`,
      quality: 95,
      tags: ["悬念", "铺垫", "紧张"],
    },
    // 师徒传承示例
    {
      id: "inheritance-1",
      category: "scene-draft",
      sceneType: "传承",
      purpose: "传承功法",
      example: `"今天，我要传你最后一式。"师父的声音很平静。

林轩跪在地上，恭敬地说："请师父指教。"

"这一式，名为'破虚'。"师父缓缓开口，"剑意凝聚到极致，可破万法，可斩虚空。但是……"

他顿了顿，眼中闪过一丝复杂："这一式会耗尽你所有的灵力，甚至可能损伤根基。非生死关头，不可轻易使用。"

"弟子明白。"

"好。"师父抬起手，指尖凝聚出一道剑气，"看好了。"

剑气在空中盘旋，变幻出无数剑影，最后凝聚成一点，轻轻一划。

"嗤——"

空间仿佛被撕裂了一道口子。

林轩瞪大眼睛，震撼得说不出话来。这就是破虚式的威力？

"记住了吗？"师父收回手，脸色有些苍白。

"记住了。"林轩郑重地点头，"弟子一定不辱师门。"`,
      quality: 93,
      tags: ["传承", "师徒", "成长"],
    },
    // 反派登场示例
    {
      id: "villain-1",
      category: "scene-draft",
      sceneType: "登场",
      purpose: "反派登场",
      example: `"听说，有人在找我？"

声音从黑暗中传来，阴冷刺骨。

林轩猛地转身，只见一个黑袍人缓缓走出阴影。他的脸隐藏在兜帽下，看不清容貌，但那双眼睛，却如同深渊般令人心悸。

"你就是血影？"林轩握紧剑柄。

"血影？"黑袍人轻笑一声，"这个名字，已经很久没人叫过了。"

他抬起手，掌心浮现出一团黑色的火焰："看来，你就是那个杀了我三个手下的小鬼。"

林轩感觉到一股强大的压迫感，冷汗顺着额头滑落。这个人的实力，远在他之上！

"怎么，害怕了？"血影戏谑地说，"放心，我不会让你死得太快。我要让你尝尝，什么叫做真正的绝望。"

黑色火焰在他手中跳跃，空气中弥漫着死亡的气息。

林轩咬牙，摆出战斗姿态。即使是死，他也要战到最后一刻！`,
      quality: 94,
      tags: ["反派", "登场", "压迫感"],
    },
    // 逃亡追逐示例
    {
      id: "chase-1",
      category: "scene-draft",
      sceneType: "追逐",
      purpose: "逃亡追逐",
      example: `"快跑！"

林轩拉着苏婉的手，在林间疾驰。身后传来阵阵破空声，追兵越来越近了。

"他们追上来了！"苏婉气喘吁吁。

"我知道！"林轩咬牙，"再坚持一下，前面就是悬崖，我们跳下去！"

"什么？"苏婉惊呼，"那可是百丈悬崖！"

"不跳就是死路一条！"林轩回头看了一眼，至少有十几个黑衣人在追赶，"相信我！"

破空声越来越近，甚至能听到追兵的呼喊声。

"站住！"

"就是现在！"林轩大喝一声，拉着苏婉纵身跃下悬崖。

耳边是呼啸的风声，下方是看不见底的深渊。苏婉紧紧抓着林轩的手，闭上了眼睛。

"抓紧我！"林轩在空中调整身形，手中剑诀变换，"御剑术！"

长剑化作流光，托住两人的身体，斜斜地向下滑去。`,
      quality: 93,
      tags: ["追逐", "紧张", "冒险"],
    },
    // 顿悟示例
    {
      id: "enlightenment-1",
      category: "scene-draft",
      sceneType: "顿悟",
      purpose: "顿悟领悟",
      example: `林轩呆呆地看着眼前的落叶。

一片叶子从树上飘落，在空中旋转、翻飞，最后轻轻落在地上。

就是这么简单的一个动作，却让林轩心中一震。

落叶归根，顺应自然。剑道，不也是如此吗？

他一直追求剑法的刚猛霸道，却忘了剑道的本质——顺势而为，借力打力。

"原来如此。"林轩喃喃自语，眼中闪过明悟的光芒。

他抬起手，轻轻一挥。剑气如同那片落叶，看似轻飘飘的，却蕴含着无穷的力量。

"师父说的'以柔克刚'，原来是这个意思。"

这一刻，困扰他多年的瓶颈，终于松动了。

林轩盘膝坐下，开始运转功法。周围的灵气如同受到召唤，缓缓汇聚而来。

顿悟，来了。`,
      quality: 92,
      tags: ["顿悟", "领悟", "成长"],
    },
    // 重逢示例
    {
      id: "reunion-1",
      category: "scene-draft",
      sceneType: "重逢",
      purpose: "久别重逢",
      example: `人群中，林轩看到了一个熟悉的身影。

那个背影，他做梦都不会忘记。

"婉儿？"他试探性地喊了一声。

那人转过身，看到林轩的瞬间，手中的包裹掉在了地上。

"林轩？"她的声音在颤抖，"真的是你？"

"是我。"林轩快步走上前，"我回来了。"

苏婉的眼眶瞬间红了："你这个骗子，说好三年就回来，结果一去就是五年！"

"对不起。"林轩低下头，"路上遇到了些麻烦。"

"什么麻烦？"苏婉擦了擦眼泪，上下打量着他，"你受伤了？"

"都是小伤，已经好了。"林轩笑了笑，"倒是你，这些年过得怎么样？"

"还能怎么样？"苏婉别过头，"每天都在担心你会不会出事，会不会再也回不来了。"

林轩心中一暖，伸手握住她的手："对不起，让你担心了。"

"傻瓜。"苏婉转过头，眼中含着泪光，"却笑了，"回来就好。"`,
      quality: 94,
      tags: ["重逢", "情感", "温馨"],
    },
    // ========================================================================
    // 项目创意示例 (Project Meta Examples) - 用于指导项目创建
    // ========================================================================
    {
      id: "project-meta-xianxia-creative",
      category: "project-meta",
      sceneType: "玄幻",
      purpose: "创意参考",
      example: JSON.stringify({
        title: "以画入道：墨染青天",
        premise: "在这个世界，天地是一幅巨大的画卷，灵气是未干的墨迹。传统修真者吞噬墨迹以强身，导致画卷逐渐褪色，世界走向枯竭。主角顾清源本是画师，意外发现自己不仅能吸收墨迹，更能'落笔生灵'，修复画卷。他必须在修真界疯狂掠夺资源的潮流中，走出一条'以画补天'的全新道途，对抗试图将世界涂抹成白纸的'虚无教派'。",
        themeTags: ["非传统修仙", "艺术入道", "救世", "哲学"],
        toneProfile: "唯美苍凉，充满东方美学意境，既有大道的宏大，又有文人的孤傲。",
        coreConflicts: [
          "掠夺式修真与修复式入道的理念冲突",
          "主角试图修复世界，却被视为异类和资源的浪费者",
          "虚无教派试图抹去一切存在，回归空白的终极威胁"
        ],
        mainEntities: [
          {
            name: "顾清源",
            role: "主角",
            shortMotivation: "寻找失踪的师父，证明'画道'可救世",
            personality: "外表温润如玉，内心执拗疯狂，对美有极致追求",
            appearance: "常年沾染墨迹的白衣，手指修长，眼神清澈如水",
            background: "落魄画师，因不愿随波逐流修炼掠夺法门而被逐出家族",
            abilities: "神笔马良般的具象化能力，能修改局部现实规则"
          },
          {
            name: "墨染",
            role: "反派",
            shortMotivation: "证明世界本就是错误的，应当回归虚无",
            personality: "虚无主义者，冷静理智到近乎冷酷",
            appearance: "全身包裹在黑雾中，没有固定形体",
            background: "曾是守护画卷的最强画师，因看透世界本质而绝望",
            abilities: "抹除存在，将一切还原为原始灵气"
          }
        ],
        worldRules: [
          "万物皆为笔墨所化，修为越高，越能看清事物的线条本质",
          "过度吸收灵气会导致区域'白化'，成为没有任何法则的死地",
          "画师的笔是本命法宝，笔折人亡"
        ],
        keywords: ["画道", "墨迹", "白化", "修复", "意境"]
      }, null, 2),
      quality: 98,
      tags: ["玄幻", "创新", "非套路"],
    },
    {
      id: "project-meta-suspense-creative",
      category: "project-meta",
      sceneType: "悬疑",
      purpose: "创意参考",
      example: JSON.stringify({
        title: "记忆当铺",
        premise: "老城区有一家只在雨夜开门的当铺，不收金银，只收'记忆'。人们典当痛苦的记忆换取好运，典当快乐的记忆换取财富。主角陈默是当铺的朝奉（鉴定师），他发现最近收到的记忆碎片中，拼凑出了一场正在发生的、针对全城的'记忆篡改'阴谋。他必须在自己的记忆被慢慢吞噬之前，找出幕后黑手。",
        themeTags: ["记忆操纵", "都市传说", "人性博弈", "烧脑"],
        toneProfile: "阴冷潮湿的黑色电影风格，充满压抑感和由于记忆缺失带来的迷茫感。",
        coreConflicts: [
          "主角想要探寻真相，但真相可能藏在他已经典当的记忆里",
          "客户为了欲望出卖记忆，与主角试图保护记忆的冲突",
          "幕后黑手试图通过改写集体记忆来控制城市"
        ],
        mainEntities: [
          {
            name: "陈默",
            role: "主角",
            shortMotivation: "找回自己缺失的童年记忆",
            personality: "沉默寡言，观察力敏锐，患有间歇性失忆症",
            appearance: "总是戴着金丝眼镜，脸色苍白，穿着旧式长衫",
            background: "孤儿，从小在当铺长大，不知道自己的过去",
            abilities: "共情能力，能读取物品上残留的情感波动"
          },
          {
            name: "老板娘",
            role: "配角",
            shortMotivation: "维持当铺的秩序，等待某人归来",
            personality: "风情万种却又神秘莫测，似乎活了很久",
            appearance: "总是穿着旗袍，手持一把红纸伞",
            background: "当铺的实际管理者，来历成谜",
            abilities: "操控时间的流速，封印记忆"
          }
        ],
        worldRules: [
          "记忆一旦典当，就会从脑海中彻底消失，除非赎回",
          "强行读取他人的记忆会遭受'精神污染'",
          "当铺内禁止动武，违者会被剥夺五感"
        ],
        keywords: ["当铺", "记忆碎片", "雨夜", "交易", "真相"]
      }, null, 2),
      quality: 96,
      tags: ["悬疑", "脑洞", "设定"],
    },
    {
      id: "project-meta-urban-creative",
      category: "project-meta",
      sceneType: "都市",
      purpose: "创意参考",
      example: JSON.stringify({
        title: "反向穿越：古人直播间",
        premise: "主角李云飞的手机意外连接到了各个朝代的'平行时空'，但不是他穿越过去，而是古人的生活以'直播'形式出现在他手机上。他发现自己可以通过打赏（传送现代物品）和弹幕（发送信息）来影响历史。然而，每一次历史的微小改变，都会引发蝴蝶效应，导致他所在的现代世界发生剧变。他必须在拯救历史悲剧和维护现代秩序之间寻找平衡。",
        themeTags: ["历史干涉", "蝴蝶效应", "古今对话", "群像"],
        toneProfile: "轻松幽默中夹杂着历史的厚重感，随着剧情推进逐渐变得紧张刺激。",
        coreConflicts: [
          "主角试图弥补历史遗憾（如救下岳飞）与现代世界因此崩溃的冲突",
          "古人对'天音'（主角弹幕）的误解和利用",
          "神秘组织试图夺取手机，改写历史以谋取私利"
        ],
        mainEntities: [
          {
            name: "李云飞",
            role: "主角",
            shortMotivation: "最初为了赚钱，后来为了守护两个时空的平衡",
            personality: "机智乐观，有点小贪财但大是大非分明",
            appearance: "普通宅男形象，黑眼圈重",
            background: "历史系落榜生，现在是不得志的网文写手",
            abilities: "拥有连接古今的手机，熟知历史走向"
          },
          {
            name: "嬴政",
            role: "配角",
            shortMotivation: "通过'仙人'指点，建立万世不朽的大秦",
            personality: "霸气侧漏，多疑但也求贤若渴",
            appearance: "虽是少年模样，却有帝王威仪",
            background: "平行时空的秦王，正在遭遇刺杀危机",
            abilities: "帝王权术，能调动举国之力"
          }
        ],
        worldRules: [
          "打赏物品必须符合当时的物理规则，不能传送高科技成品，但可以传送图纸",
          "历史改变程度超过阈值，现代世界就会重置",
          "直播间有等级限制，等级越高能连接的朝代越多"
        ],
        keywords: ["直播", "历史", "蝴蝶效应", "打赏", "权谋"]
      }, null, 2),
      quality: 97,
      tags: ["都市", "脑洞", "历史"],
    }
  ];

  /**
   * 获取相关示例
   * 根据场景类型和目的选择最合适的示例
   * 支持使用embedding模型进行语义匹配
   */
  async getRelevantExamples(
    sceneType: string,
    purpose: string,
    maxExamples: number = 1,
    useEmbedding: boolean = false,
    userId?: string
  ): Promise<FewShotExample[]> {
    // 如果启用embedding且有向量模型，使用语义匹配
    if (useEmbedding) {
      try {
        const semanticResults = await this.getRelevantExamplesByEmbedding(
          sceneType,
          purpose,
          maxExamples,
          userId
        );
        if (semanticResults.length > 0) {
          return semanticResults;
        }
      } catch (error) {
        console.log("[Few-shot] Embedding match failed, fallback to keyword match");
      }
    }

    // 关键词匹配（回退方案）
    const relevantExamples = this.examples.filter((example) => {
      // 检查场景类型匹配
      if (sceneType && example.sceneType.includes(sceneType)) {
        return true;
      }

      // 检查目的匹配
      if (purpose) {
        const purposeKeywords = this.extractKeywords(purpose);
        const exampleKeywords = this.extractKeywords(example.purpose);

        const overlap = purposeKeywords.filter((k) =>
          exampleKeywords.some((e) => e.includes(k) || k.includes(e))
        );

        if (overlap.length > 0) {
          return true;
        }
      }

      return false;
    });

    // 按质量排序并返回
    return relevantExamples
      .sort((a, b) => b.quality - a.quality)
      .slice(0, maxExamples);
  }

  /**
   * 使用embedding模型进行语义匹配
   */
  private async getRelevantExamplesByEmbedding(
    sceneType: string,
    purpose: string,
    maxExamples: number,
    userId?: string
  ): Promise<FewShotExample[]> {
    // 导入aiService（避免循环依赖）
    const { aiService } = await import("./ai-service");

    // 构建查询文本
    const query = `场景类型：${sceneType}，场景目的：${purpose}`;

    // 获取查询的embedding
    const queryEmbedding = await aiService.getEmbedding(query, userId);
    if (!queryEmbedding) {
      throw new Error("Failed to get query embedding");
    }

    // 计算与所有示例的相似度
    const similarities: Array<{ example: FewShotExample; similarity: number }> = [];

    for (const example of this.examples) {
      const exampleText = `场景类型：${example.sceneType}，场景目的：${example.purpose}`;
      const exampleEmbedding = await aiService.getEmbedding(exampleText, userId);

      if (exampleEmbedding) {
        const similarity = this.cosineSimilarity(queryEmbedding, exampleEmbedding);
        similarities.push({ example, similarity });
      }
    }

    // 按相似度排序
    similarities.sort((a, b) => b.similarity - a.similarity);

    // 返回最相似的示例
    return similarities.slice(0, maxExamples).map((s) => s.example);
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
  }

  /**
   * 构建Few-shot提示词模块
   */
  async buildFewShotModule(
    sceneType: string,
    purpose: string,
    useEmbedding: boolean = false,
    userId?: string
  ): Promise<string | null> {
    const examples = await this.getRelevantExamples(sceneType, purpose, 1, useEmbedding, userId);

    if (examples.length === 0) {
      return null;
    }

    const example = examples[0];

    return `# 参考示例

【场景类型】：${example.sceneType}
【场景目的】：${example.purpose}

【示例内容】：
${example.example}

注意：这只是参考示例，请根据当前场景的具体要求创作，不要照搬示例内容。`;
  }

  /**
   * 添加新示例
   */
  addExample(example: Omit<FewShotExample, "id">): void {
    const id = `custom-${Date.now()}`;
    this.examples.push({ ...example, id });
  }

  /**
   * 获取所有示例
   */
  getAllExamples(): FewShotExample[] {
    return this.examples;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    const commonWords = [
      "的", "了", "在", "是", "和", "与", "等", "着", "中",
      "到", "从", "对", "为", "以", "将", "被", "有", "个",
    ];

    const words = text
      .split(/[，。、：；！？\s]/)
      .filter((w) => w.length >= 2 && !commonWords.includes(w));

    return Array.from(new Set(words));
  }
}

export const fewShotExamplesService = new FewShotExamplesService();
