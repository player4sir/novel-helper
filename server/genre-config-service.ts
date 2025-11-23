// Genre Configuration Service
// 小说类型配置服务 - 支持动态配置和扩展

export interface GenreConfig {
  id: string;
  name: string;
  keywords: string[];
  description: string;
  priority: number; // 匹配优先级，数字越大优先级越高
}

export class GenreConfigService {
  private genres: GenreConfig[] = [
    {
      id: "xianxia",
      name: "仙侠",
      keywords: ["修仙", "仙侠", "飞升", "渡劫", "元婴", "金丹", "筑基"],
      description: "修仙题材，包含修炼体系和境界突破",
      priority: 10,
    },
    {
      id: "xuanhuan",
      name: "玄幻",
      keywords: ["玄幻", "魔法", "异界", "斗气", "魔兽", "位面"],
      description: "玄幻题材，包含魔法和异世界元素",
      priority: 9,
    },
    {
      id: "wuxia",
      name: "武侠",
      keywords: ["武侠", "江湖", "武功", "侠客", "门派", "武林"],
      description: "武侠题材，包含武功和江湖恩怨",
      priority: 8,
    },
    {
      id: "urban",
      name: "都市",
      keywords: ["都市", "现代", "都会", "职场", "商战", "豪门"],
      description: "都市题材，现代都市生活背景",
      priority: 7,
    },
    {
      id: "scifi",
      name: "科幻",
      keywords: ["科幻", "未来", "星际", "机甲", "赛博", "末世"],
      description: "科幻题材，包含未来科技元素",
      priority: 6,
    },
    {
      id: "history",
      name: "历史",
      keywords: ["历史", "古代", "穿越", "架空", "朝堂", "宫廷"],
      description: "历史题材，古代历史背景",
      priority: 5,
    },
    {
      id: "romance",
      name: "言情",
      keywords: ["言情", "爱情", "恋爱", "情感", "甜宠", "虐恋"],
      description: "言情题材，以情感发展为主线",
      priority: 4,
    },
    {
      id: "game",
      name: "游戏",
      keywords: ["游戏", "网游", "电竞", "虚拟", "副本", "公会"],
      description: "游戏题材，虚拟游戏世界",
      priority: 3,
    },
    {
      id: "suspense",
      name: "悬疑",
      keywords: ["悬疑", "推理", "侦探", "破案", "谜团", "真相"],
      description: "悬疑推理题材",
      priority: 2,
    },
    {
      id: "horror",
      name: "恐怖",
      keywords: ["恐怖", "惊悚", "灵异", "鬼怪", "诡异", "恐惧"],
      description: "恐怖灵异题材",
      priority: 1,
    },
  ];

  /**
   * 根据关键词推断类型
   */
  inferGenre(keywords: string[]): string {
    const text = keywords.join(" ").toLowerCase();

    // 按优先级排序，优先匹配高优先级类型
    const sortedGenres = [...this.genres].sort((a, b) => b.priority - a.priority);

    for (const genre of sortedGenres) {
      // 检查是否包含该类型的任何关键词
      const hasKeyword = genre.keywords.some((keyword) =>
        text.includes(keyword.toLowerCase())
      );

      if (hasKeyword) {
        return genre.name;
      }
    }

    return "其他";
  }

  /**
   * 根据文本内容推断类型（支持更复杂的匹配）
   */
  inferGenreFromText(text: string): string {
    const lowerText = text.toLowerCase();
    const matches: Array<{ genre: GenreConfig; score: number }> = [];

    for (const genre of this.genres) {
      let score = 0;

      // 计算匹配分数
      for (const keyword of genre.keywords) {
        const keywordLower = keyword.toLowerCase();
        const count = (lowerText.match(new RegExp(keywordLower, "g")) || []).length;
        score += count * genre.priority;
      }

      if (score > 0) {
        matches.push({ genre, score });
      }
    }

    // 按分数排序，返回最高分的类型
    if (matches.length > 0) {
      matches.sort((a, b) => b.score - a.score);
      return matches[0].genre.name;
    }

    return "其他";
  }

  /**
   * 获取所有类型配置
   */
  getAllGenres(): GenreConfig[] {
    return [...this.genres];
  }

  /**
   * 根据ID获取类型配置
   */
  getGenreById(id: string): GenreConfig | undefined {
    return this.genres.find((g) => g.id === id);
  }

  /**
   * 根据名称获取类型配置
   */
  getGenreByName(name: string): GenreConfig | undefined {
    return this.genres.find((g) => g.name === name);
  }

  /**
   * 添加自定义类型
   */
  addGenre(genre: GenreConfig): void {
    // 检查是否已存在
    const exists = this.genres.some((g) => g.id === genre.id || g.name === genre.name);
    if (exists) {
      throw new Error(`Genre with id "${genre.id}" or name "${genre.name}" already exists`);
    }

    this.genres.push(genre);
  }

  /**
   * 更新类型配置
   */
  updateGenre(id: string, updates: Partial<GenreConfig>): void {
    const index = this.genres.findIndex((g) => g.id === id);
    if (index === -1) {
      throw new Error(`Genre with id "${id}" not found`);
    }

    this.genres[index] = { ...this.genres[index], ...updates };
  }

  /**
   * 删除类型配置
   */
  removeGenre(id: string): void {
    const index = this.genres.findIndex((g) => g.id === id);
    if (index === -1) {
      throw new Error(`Genre with id "${id}" not found`);
    }

    this.genres.splice(index, 1);
  }

  /**
   * 获取类型的关键词列表（用于提示词生成）
   */
  getGenreKeywords(genreName: string): string[] {
    const genre = this.getGenreByName(genreName);
    return genre ? genre.keywords : [];
  }

  /**
   * 检查文本是否匹配某个类型
   */
  matchesGenre(text: string, genreName: string): boolean {
    const genre = this.getGenreByName(genreName);
    if (!genre) return false;

    const lowerText = text.toLowerCase();
    return genre.keywords.some((keyword) =>
      lowerText.includes(keyword.toLowerCase())
    );
  }
}

export const genreConfigService = new GenreConfigService();
