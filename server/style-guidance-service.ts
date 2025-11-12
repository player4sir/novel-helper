/**
 * Style Guidance Service
 * 
 * 为不同的小说风格提供具体的写作指导和技巧
 */

interface StyleGuidance {
  name: string;
  description: string;
  writingTechniques: string[];
  dialogueGuidance: string;
  descriptionGuidance: string;
  paceGuidance: string;
  examples: string[];
  avoidances: string[];
}

class StyleGuidanceService {
  private styleGuides: Map<string, StyleGuidance> = new Map();

  constructor() {
    this.initializeStyleGuides();
  }

  private initializeStyleGuides() {
    // 幽默搞笑风格
    this.styleGuides.set("幽默搞笑", {
      name: "幽默搞笑",
      description: "轻松诙谐的叙事风格，通过夸张、反转、吐槽等手法制造笑点",
      writingTechniques: [
        "使用夸张的比喻和形容（如：他的脸比锅底还黑）",
        "制造意外反转（角色期待A，结果发生B）",
        "运用吐槽和自嘲（角色对荒谬情况的内心吐槽）",
        "使用谐音梗和文字游戏",
        "描写角色的囧态和尴尬时刻",
        "加入现代网络用语和流行梗（适度）",
      ],
      dialogueGuidance: `对话要活泼生动，多用：
- 俏皮话和调侃
- 夸张的反应（"我的天！"、"这也太离谱了吧！"）
- 角色间的互怼和抬杠
- 自嘲和吐槽（"我真是个天才...天才般的蠢货"）
- 错位的严肃（用严肃的语气说搞笑的话）`,
      descriptionGuidance: `描写要夸张有趣：
- 使用夸张的比喻（"他跑得比兔子还快，比猎豹还慢"）
- 描写角色的滑稽动作和表情
- 用幽默的视角看待严肃场景
- 加入意外的细节制造反差`,
      paceGuidance: `节奏要轻快跳跃：
- 快速推进，不拖沓
- 频繁制造小笑点
- 用短句和对话保持节奏
- 在紧张时刻插入搞笑元素缓解`,
      examples: [
        "他一脸严肃地说：'我要告诉你一个秘密。'然后凑近我耳边，'其实...我也不知道。'",
        "她优雅地转身，裙摆飞扬，然后华丽地撞上了门框。",
        "这招式名叫'天外飞仙'，实际效果是'地上爬虫'。",
      ],
      avoidances: [
        "避免过于严肃沉重的描写",
        "避免长篇大论的心理分析",
        "避免过度煽情",
        "避免生硬的说教",
      ],
    });

    // 热血战斗风格
    this.styleGuides.set("热血战斗", {
      name: "热血战斗",
      description: "激情澎湃的战斗场面，强调力量、速度和战斗技巧",
      writingTechniques: [
        "使用短句营造紧张感",
        "详细描写动作细节和招式",
        "强调力量的视觉冲击",
        "加入战斗中的心理博弈",
        "描写环境的破坏和变化",
      ],
      dialogueGuidance: `对话要简短有力：
- 战斗中的怒吼和宣言
- 简短的战术交流
- 挑衅和回应
- 关键时刻的觉悟台词`,
      descriptionGuidance: `描写要动感十足：
- 详细的动作分解
- 力量的视觉化表现
- 速度感的营造
- 环境的动态变化`,
      paceGuidance: `节奏要快速紧凑：
- 短句连击
- 动作连贯
- 高潮迭起
- 适时的喘息`,
      examples: [
        "拳风呼啸，空气被撕裂！",
        "他的身影化作残影，下一瞬已出现在敌人身后。",
        "'就是现在！'他怒吼一声，全身力量汇聚于拳锋。",
      ],
      avoidances: [
        "避免拖沓的心理描写",
        "避免过多的环境铺垫",
        "避免战斗中的长篇对话",
      ],
    });

    // 悬疑推理风格
    this.styleGuides.set("悬疑推理", {
      name: "悬疑推理",
      description: "层层推进的谜题，通过线索和推理揭示真相",
      writingTechniques: [
        "埋设伏笔和线索",
        "制造悬念和疑问",
        "使用细节描写暗示真相",
        "展现推理过程",
        "制造红鲱鱼（假线索）",
      ],
      dialogueGuidance: `对话要含蓄深意：
- 话中有话，暗藏玄机
- 关键信息的透露和隐藏
- 推理过程的展现
- 质疑和反驳`,
      descriptionGuidance: `描写要细致入微：
- 关键细节的特写
- 环境氛围的营造
- 人物微表情和小动作
- 异常之处的强调`,
      paceGuidance: `节奏要张弛有度：
- 线索收集时从容
- 推理时紧凑
- 真相揭示时爆发
- 适时的反转`,
      examples: [
        "他的目光在房间里扫过，突然停在了那个不起眼的角落。",
        "'有意思，'她喃喃自语，'如果他说的是真的，那么...'",
        "所有的线索都指向同一个结论，但总觉得哪里不对。",
      ],
      avoidances: [
        "避免过早揭示答案",
        "避免逻辑漏洞",
        "避免强行反转",
      ],
    });

    // 浪漫言情风格
    this.styleGuides.set("浪漫言情", {
      name: "浪漫言情",
      description: "细腻的情感描写，展现角色间的情感发展",
      writingTechniques: [
        "细腻的心理描写",
        "情感的层次递进",
        "氛围的营造",
        "小细节的捕捉",
        "情感的冲突和和解",
      ],
      dialogueGuidance: `对话要含情脉脉：
- 欲言又止的暗示
- 情感的试探和回应
- 甜蜜的互动
- 误会和解释`,
      descriptionGuidance: `描写要细腻温柔：
- 人物的神态和眼神
- 心跳和脸红的生理反应
- 浪漫的环境氛围
- 情感的微妙变化`,
      paceGuidance: `节奏要舒缓优美：
- 情感的慢慢发酵
- 关键时刻的停顿
- 甜蜜时刻的延展
- 冲突时的激烈`,
      examples: [
        "他的目光温柔得像要滴出水来。",
        "她的心跳得厉害，几乎要跳出胸腔。",
        "'我...'她咬了咬唇，终于鼓起勇气，'我喜欢你。'",
      ],
      avoidances: [
        "避免过于直白",
        "避免肉麻的形容",
        "避免情感的突兀转变",
      ],
    });

    // 玄幻修仙风格
    this.styleGuides.set("玄幻修仙", {
      name: "玄幻修仙",
      description: "宏大的世界观，修炼体系和境界突破",
      writingTechniques: [
        "展现修炼体系和境界",
        "描写法术和神通",
        "营造仙侠氛围",
        "展现实力差距",
        "描写顿悟和突破",
      ],
      dialogueGuidance: `对话要有仙侠韵味：
- 使用古风词汇（适度）
- 展现境界和见识
- 传道授业
- 论道和切磋`,
      descriptionGuidance: `描写要恢宏大气：
- 法术的视觉效果
- 灵气的流动
- 境界的突破
- 天地异象`,
      paceGuidance: `节奏要有起伏：
- 修炼时的沉静
- 战斗时的激烈
- 顿悟时的升华
- 突破时的震撼`,
      examples: [
        "灵气如潮水般涌入丹田，周身经脉发出阵阵轰鸣。",
        "'此子悟性惊人，假以时日，必成大器。'",
        "剑光一闪，虚空被撕裂出一道漆黑的裂缝。",
      ],
      avoidances: [
        "避免过度堆砌术语",
        "避免境界体系混乱",
        "避免力量体系崩坏",
      ],
    });

    // 都市生活风格
    this.styleGuides.set("都市生活", {
      name: "都市生活",
      description: "贴近现实的都市生活，展现现代人的喜怒哀乐",
      writingTechniques: [
        "使用现代生活场景",
        "展现职场和生活压力",
        "描写现代人的心理",
        "加入社会热点元素",
        "展现人际关系",
      ],
      dialogueGuidance: `对话要贴近生活：
- 使用现代口语
- 展现职场交流
- 朋友间的闲聊
- 家庭对话`,
      descriptionGuidance: `描写要真实细腻：
- 都市场景的细节
- 现代生活的质感
- 人物的穿着打扮
- 心理的真实反映`,
      paceGuidance: `节奏要自然流畅：
- 生活化的节奏
- 情节的自然推进
- 冲突的合理展开
- 情感的真实流露`,
      examples: [
        "地铁里人挤人，她紧紧抓着扶手，心里盘算着今天的工作安排。",
        "'老板又加班了？'同事递过来一杯咖啡，'辛苦了。'",
        "手机震动，是房东催租的消息。她叹了口气，这个月又要吃土了。",
      ],
      avoidances: [
        "避免脱离现实",
        "避免过度理想化",
        "避免情节狗血",
      ],
    });
  }

  /**
   * 获取风格指导
   */
  getStyleGuidance(style: string): StyleGuidance | null {
    // 精确匹配
    if (this.styleGuides.has(style)) {
      return this.styleGuides.get(style)!;
    }

    // 模糊匹配
    const entries = Array.from(this.styleGuides.entries());
    for (const [key, guide] of entries) {
      if (style.includes(key) || key.includes(style)) {
        return guide;
      }
    }

    return null;
  }

  /**
   * 构建风格指导 Prompt 模块
   */
  buildStyleGuidancePrompt(style: string): string {
    const guidance = this.getStyleGuidance(style);
    
    if (!guidance) {
      return `# 写作风格
风格：${style}

请按照"${style}"的风格特点进行创作，注意保持风格的一致性。`;
    }

    return `# 写作风格：${guidance.name}

## 风格特点
${guidance.description}

## 核心技巧
${guidance.writingTechniques.map((t, i) => `${i + 1}. ${t}`).join("\n")}

## 对话指导
${guidance.dialogueGuidance}

## 描写指导
${guidance.descriptionGuidance}

## 节奏控制
${guidance.paceGuidance}

## 风格示例
${guidance.examples.map((e, i) => `示例${i + 1}：${e}`).join("\n")}

## 注意事项
${guidance.avoidances.map((a, i) => `${i + 1}. ${a}`).join("\n")}

**重要**：请严格按照以上风格特点进行创作，确保每个场景都体现"${guidance.name}"的特色。`;
  }

  /**
   * 获取风格相关的 Few-shot 示例提示
   */
  getStyleFewShotHint(style: string): string {
    const guidance = this.getStyleGuidance(style);
    
    if (!guidance) {
      return "";
    }

    return `注意：参考示例的写作手法，但要确保符合"${guidance.name}"风格的特点。`;
  }

  /**
   * 获取所有支持的风格
   */
  getSupportedStyles(): string[] {
    return Array.from(this.styleGuides.keys());
  }
}

export const styleGuidanceService = new StyleGuidanceService();
