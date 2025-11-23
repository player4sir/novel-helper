// Cliché Detection Utility for Novel Content
// Detects common patterns and tropes in Chinese web novels

export interface ClichePattern {
    id: string;
    name: string;
    nameEn: string;
    category: 'character' | 'plot' | 'worldview' | 'relationship';
    keywords: string[];
    description: string;
    severity: 'low' | 'medium' | 'high'; // How common/overused this pattern is
    penalty: number; // Score reduction (0-20)
}

export interface ClicheDetectionResult {
    detected: ClichePattern[];
    score: number; // 0-100, higher is more original
    suggestions: string[];
    totalPenalty: number;
}

// Comprehensive cliché pattern database
const CLICHE_PATTERNS: ClichePattern[] = [
    // === Character Clichés ===
    {
        id: 'char_001',
        name: '龙傲天主角',
        nameEn: 'Overpowered Protagonist',
        category: 'character',
        keywords: ['无敌', '秒杀', '碾压', '天下第一', '举世无双', '最强', '至尊', '不败'],
        description: '主角过于强大，缺乏成长空间和挑战',
        severity: 'high',
        penalty: 15,
    },
    {
        id: 'char_002',
        name: '废柴逆袭',
        nameEn: 'Trash to Hero',
        category: 'character',
        keywords: ['废柴', '废物', '垃圾', '被欺负', '被嘲笑', '天赋最差', '修为最低'],
        description: '主角从被鄙视的废柴变成强者（过于常见）',
        severity: 'high',
        penalty: 15,
    },
    {
        id: 'char_003',
        name: '完美女主',
        nameEn: 'Perfect Female Lead',
        category: 'character',
        keywords: ['完美', '倾国倾城', '天仙', '绝世美女', '人见人爱', '没有缺点'],
        description: '女主角过于完美，缺乏真实性和成长',
        severity: 'medium',
        penalty: 10,
    },
    {
        id: 'char_004',
        name: '神秘前辈',
        nameEn: 'Mysterious Master',
        category: 'character',
        keywords: ['神秘老者', '白衣老者', '神秘前辈', '隐世强者', '高人'],
        description: '神秘前辈传授功法或指点迷津',
        severity: 'medium',
        penalty: 8,
    },
    {
        id: 'char_005',
        name: '傲娇大小姐',
        nameEn: 'Tsundere Young Miss',
        category: 'character',
        keywords: ['大小姐', '娇蛮', '任性', '刁蛮', '高傲', '看不起'],
        description: '傲娇的富家千金，后来被主角征服',
        severity: 'medium',
        penalty: 8,
    },

    // === Plot Clichés ===
    {
        id: 'plot_001',
        name: '金手指系统',
        nameEn: 'Cheat System',
        category: 'plot',
        keywords: ['系统', '签到', '抽奖', '任务', '兑换', '商城', '挂机'],
        description: '主角获得系统类金手指',
        severity: 'high',
        penalty: 18,
    },
    {
        id: 'plot_002',
        name: '退婚打脸',
        nameEn: 'Broken Engagement Revenge',
        category: 'plot',
        keywords: ['退婚', '解除婚约', '悔婚', '三十年河东', '三十年河西', '莫欺少年穷'],
        description: '被退婚后变强回来打脸',
        severity: 'high',
        penalty: 20,
    },
    {
        id: 'plot_003',
        name: '扮猪吃老虎',
        nameEn: 'Hidden Strength',
        category: 'plot',
        keywords: ['扮猪吃老虎', '隐藏实力', '装弱', '低调', '深藏不露', '不显山不露水'],
        description: '主角隐藏真实实力，假装弱小',
        severity: 'medium',
        penalty: 10,
    },
    {
        id: 'plot_004',
        name: '强者归来',
        nameEn: 'Powerful Return',
        category: 'plot',
        keywords: ['归来', '王者归来', '回归', '离开后变强', '重返'],
        description: '主角离开后实力大增，强势回归',
        severity: 'medium',
        penalty: 10,
    },
    {
        id: 'plot_005',
        name: '穿越重生',
        nameEn: 'Transmigration/Rebirth',
        category: 'plot',
        keywords: ['穿越', '重生', '转世', '回到过去', '记忆觉醒', '前世'],
        description: '主角穿越或重生获得优势',
        severity: 'high',
        penalty: 15,
    },
    {
        id: 'plot_006',
        name: '捡到神器',
        nameEn: 'Found Divine Artifact',
        category: 'plot',
        keywords: ['神器', '上古神器', '至宝', '法宝', '捡到', '意外获得'],
        description: '主角意外捡到强大神器',
        severity: 'medium',
        penalty: 10,
    },
    {
        id: 'plot_007',
        name: '天赋觉醒',
        nameEn: 'Talent Awakening',
        category: 'plot',
        keywords: ['觉醒', '血脉觉醒', '天赋觉醒', '突然发现', '潜力爆发'],
        description: '主角突然觉醒强大天赋',
        severity: 'medium',
        penalty: 10,
    },
    {
        id: 'plot_008',
        name: '奇遇连连',
        nameEn: 'Lucky Encounters',
        category: 'plot',
        keywords: ['奇遇', '机缘', '幸运', '掉落悬崖', '山洞', '洞府', '遗迹'],
        description: '主角频繁获得各种奇遇机缘',
        severity: 'medium',
        penalty: 12,
    },
    {
        id: 'plot_009',
        name: '比武招亲',
        nameEn: 'Martial Arts Contest for Marriage',
        category: 'plot',
        keywords: ['比武招亲', '招亲', '比试', '赢得美人'],
        description: '通过比武招亲获得女主',
        severity: 'low',
        penalty: 6,
    },
    {
        id: 'plot_010',
        name: '打脸升级',
        nameEn: 'Face-Slapping Upgrade',
        category: 'plot',
        keywords: ['打脸', '啪啪', '众人震惊', '所有人都惊呆了', '不可能'],
        description: '主角不断打脸质疑者',
        severity: 'high',
        penalty: 15,
    },

    // === Worldview Clichés ===
    {
        id: 'world_001',
        name: '等级森严',
        nameEn: 'Strict Hierarchy',
        category: 'worldview',
        keywords: ['炼气', '筑基', '金丹', '元婴', '化神', '境界', '一到十阶', '星级'],
        description: '过于简单的等级体系',
        severity: 'medium',
        penalty: 8,
    },
    {
        id: 'world_002',
        name: '弱肉强食',
        nameEn: 'Survival of the Fittest',
        category: 'worldview',
        keywords: ['弱肉强食', '实力为尊', '拳头大就是道理', '强者生存'],
        description: '简单粗暴的强者生存法则',
        severity: 'medium',
        penalty: 8,
    },
    {
        id: 'world_003',
        name: '天赋决定论',
        nameEn: 'Talent Determinism',
        category: 'worldview',
        keywords: ['天赋', '资质', '根骨', '灵根', '血脉', '天生', '注定'],
        description: '天赋完全决定成就，缺乏其他因素',
        severity: 'medium',
        penalty: 8,
    },
    {
        id: 'world_004',
        name: '门派争斗',
        nameEn: 'Sect Conflicts',
        category: 'worldview',
        keywords: ['正派', '邪派', '魔道', '正道', '名门正派', '江湖', '武林'],
        description: '传统的正邪门派对立',
        severity: 'low',
        penalty: 5,
    },
    {
        id: 'world_005',
        name: '大陆体系',
        nameEn: 'Continent System',
        category: 'worldview',
        keywords: ['大陆', '小世界', '中千世界', '大千世界', '位面', '更高层次'],
        description: '一层层向上的大陆/位面体系',
        severity: 'medium',
        penalty: 8,
    },

    // === Relationship Clichés ===
    {
        id: 'rel_001',
        name: '后宫设定',
        nameEn: 'Harem Setup',
        category: 'relationship',
        keywords: ['后宫', '三妻四妾', '红颜知己', '佳人无数', '美女环绕'],
        description: '主角拥有多位女性伴侣',
        severity: 'medium',
        penalty: 12,
    },
    {
        id: 'rel_002',
        name: '青梅竹马',
        nameEn: 'Childhood Sweetheart',
        category: 'relationship',
        keywords: ['青梅竹马', '从小一起长大', '儿时玩伴', '邻家'],
        description: '青梅竹马成为恋人',
        severity: 'low',
        penalty: 5,
    },
    {
        id: 'rel_003',
        name: '冰山美女',
        nameEn: 'Ice-Cold Beauty',
        category: 'relationship',
        keywords: ['冰山', '冷若冰霜', '高冷', '拒人千里', '冰冷', '不近人情'],
        description: '冰冷美女被主角融化',
        severity: 'medium',
        penalty: 8,
    },
    {
        id: 'rel_004',
        name: '师徒恋',
        nameEn: 'Master-Disciple Romance',
        category: 'relationship',
        keywords: ['师徒', '师父', '徒弟', '师徒恋', '师徒情'],
        description: '师徒之间发展出恋情',
        severity: 'low',
        penalty: 6,
    },
    {
        id: 'rel_005',
        name: '英雄救美',
        nameEn: 'Hero Saves Beauty',
        category: 'relationship',
        keywords: ['英雄救美', '拯救', '保护', '救命之恩', '以身相许'],
        description: '通过救美获得芳心',
        severity: 'medium',
        penalty: 10,
    },

    // === Additional Modern Clichés ===
    {
        id: 'modern_001',
        name: '都市龙王',
        nameEn: 'Urban Dragon King',
        category: 'character',
        keywords: ['龙王', '战神', '地下世界', '隐藏身份', '退役'],
        description: '都市背景下的隐藏强者',
        severity: 'high',
        penalty: 15,
    },
    {
        id: 'modern_002',
        name: '霸总设定',
        nameEn: 'Domineering CEO',
        category: 'character',
        keywords: ['总裁', 'CEO', '霸道', '豪门', '财阀', '商业帝国'],
        description: '霸道总裁类型角色',
        severity: 'medium',
        penalty: 10,
    },
    {
        id: 'scifi_001',
        name: '星际联邦',
        nameEn: 'Galactic Federation',
        category: 'worldview',
        keywords: ['星际联邦', '宇宙联盟', '星际议会', '银河帝国'],
        description: '标准的星际联邦设定',
        severity: 'low',
        penalty: 6,
    },
    {
        id: 'scifi_002',
        name: '机甲系统',
        nameEn: 'Mecha System',
        category: 'plot',
        keywords: ['机甲', '驾驶员', '战斗机甲', '机甲战士', '机甲等级'],
        description: '常见的机甲战斗系统',
        severity: 'low',
        penalty: 5,
    },
    {
        id: 'xuanhuan_001',
        name: '吞噬提升',
        nameEn: 'Devour to Upgrade',
        category: 'plot',
        keywords: ['吞噬', '吸收', '炼化', '夺取', '掠夺'],
        description: '通过吞噬其他生命提升实力',
        severity: 'medium',
        penalty: 10,
    },
];

/**
 * Detect clichés in project metadata
 */
export function detectCliches(meta: {
    title: string;
    premise: string;
    coreConflicts: string[];
    mainEntities: Array<{
        name: string;
        role: string;
        shortMotivation: string;
        personality?: string;
        background?: string;
    }>;
    worldRules: string[];
    themeTags: string[];
    keywords: string[];
}): ClicheDetectionResult {
    const detected: ClichePattern[] = [];
    let totalPenalty = 0;

    // Combine all text fields for analysis
    const allText = [
        meta.title,
        meta.premise,
        ...meta.coreConflicts,
        ...meta.mainEntities.map(e => `${e.name} ${e.role} ${e.shortMotivation} ${e.personality || ''} ${e.background || ''}`),
        ...meta.worldRules,
        ...meta.themeTags,
        ...meta.keywords,
    ].join(' ').toLowerCase();

    // Check each pattern
    for (const pattern of CLICHE_PATTERNS) {
        const matchedKeywords = pattern.keywords.filter(keyword =>
            allText.includes(keyword.toLowerCase())
        );

        if (matchedKeywords.length > 0) {
            detected.push(pattern);
            totalPenalty += pattern.penalty;
        }
    }

    // Calculate originality score (100 - total penalty, min 0)
    const score = Math.max(0, 100 - totalPenalty);

    // Generate suggestions
    const suggestions = generateSuggestions(detected);

    return {
        detected,
        score,
        suggestions,
        totalPenalty,
    };
}

/**
 * Generate improvement suggestions based on detected clichés
 */
function generateSuggestions(detected: ClichePattern[]): string[] {
    const suggestions: string[] = [];

    // Group by category
    const byCategory: Record<string, ClichePattern[]> = {};
    detected.forEach(pattern => {
        if (!byCategory[pattern.category]) {
            byCategory[pattern.category] = [];
        }
        byCategory[pattern.category].push(pattern);
    });

    // Generate category-specific suggestions
    if (byCategory.character && byCategory.character.length > 0) {
        suggestions.push('角色设定：避免过于刻板的角色模板，增加角色的复杂性和矛盾性');
    }

    if (byCategory.plot && byCategory.plot.length > 0) {
        suggestions.push('情节设计：减少依赖"金手指"和"奇遇"，通过角色成长和选择推动剧情');
    }

    if (byCategory.worldview && byCategory.worldview.length > 0) {
        suggestions.push('世界观：构建更有深度的世界规则，避免简单的等级体系');
    }

    if (byCategory.relationship && byCategory.relationship.length > 0) {
        suggestions.push('关系设定：建立更自然和多元的人物关系，避免套路化的感情线');
    }

    // Severity-based suggestions
    const highSeverity = detected.filter(p => p.severity === 'high');
    if (highSeverity.length >= 3) {
        suggestions.push('⚠️ 警告：检测到多个高频套路，建议重新审视核心设定的独特性');
    }

    return suggestions;
}

/**
 * Check if world rules contain unusual/creative elements
 */
export function hasUnusualWorldRules(worldRules: string[]): boolean {
    if (!worldRules || worldRules.length === 0) return false;

    const commonPatterns = [
        '炼气', '筑基', '金丹', '元婴', '化神',
        '一阶', '二阶', '三阶',
        '初级', '中级', '高级',
        '弱肉强食', '实力为尊',
    ];

    const allRules = worldRules.join(' ').toLowerCase();
    const hasCommon = commonPatterns.some(pattern => allRules.includes(pattern));

    // If no common patterns and rules are detailed (>20 chars each on average)
    const avgLength = worldRules.reduce((sum, r) => sum + r.length, 0) / worldRules.length;

    return !hasCommon && avgLength > 20;
}

/**
 * Check if character motivations are complex and deep
 */
export function hasComplexMotivations(entities: Array<{
    shortMotivation: string;
    personality?: string;
}>): boolean {
    if (!entities || entities.length === 0) return false;

    const complexIndicators = [
        '矛盾', '冲突', '挣扎', '两难', '选择',
        '痛苦', '迷茫', '困惑', '质疑', '反思',
        '复杂', '多面', '深层', '真正的', '内心',
    ];

    let complexCount = 0;
    entities.forEach(entity => {
        const text = `${entity.shortMotivation} ${entity.personality || ''}`.toLowerCase();
        const hasComplex = complexIndicators.some(indicator => text.includes(indicator));
        if (hasComplex) complexCount++;
    });

    // At least 50% of characters have complex motivations
    return complexCount >= entities.length * 0.5;
}

/**
 * Check if conflicts are original and not cliché
 */
export function hasOriginalConflicts(conflicts: string[]): boolean {
    if (!conflicts || conflicts.length === 0) return false;

    const clicheConflicts = [
        '打脸', '复仇', '报仇', '雪耻',
        '争夺', '夺宝', '比武',
        '善恶', '正邪', '黑白',
    ];

    const allConflicts = conflicts.join(' ').toLowerCase();
    const hasCliche = clicheConflicts.some(pattern => allConflicts.includes(pattern));

    // Original if no cliché patterns and conflicts are detailed
    const avgLength = conflicts.reduce((sum, c) => sum + c.length, 0) / conflicts.length;

    return !hasCliche && avgLength > 15;
}
